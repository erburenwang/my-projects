"""Content manifests. No network, source writes, or automatic deletion."""

from __future__ import annotations

import fnmatch
import hashlib
import os
import re
import stat
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = "file-ledger/v1"
CHUNK_SIZE = 1024 * 1024


class LedgerError(ValueError):
    """An input or scan could not be trusted as complete."""


@dataclass(frozen=True)
class FileEntry:
    path: str
    size: int
    sha256: str


@dataclass(frozen=True)
class Manifest:
    created_at: str
    excludes: tuple[str, ...]
    files: tuple[FileEntry, ...]
    skipped: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema": SCHEMA,
            "algorithm": "sha256",
            "created_at": self.created_at,
            "excludes": list(self.excludes),
            "files": [asdict(entry) for entry in self.files],
            "skipped": list(self.skipped),
        }


def _valid_path(value: Any) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and "\\" not in value
        and ":" not in value
        and "\x00" not in value
        and all(part not in ("", ".", "..") for part in value.split("/"))
    )


def _patterns(values: Any) -> tuple[str, ...]:
    if not isinstance(values, (list, tuple)) or any(
        not isinstance(p, str) or not p or "\x00" in p for p in values
    ):
        raise LedgerError("excludes must be a list of non-empty patterns")
    return tuple(dict.fromkeys(values))


def parse_manifest(data: Any) -> Manifest:
    """Validate the schema before using a third-party manifest."""
    if not isinstance(data, dict) or data.get("schema") != SCHEMA:
        raise LedgerError("Unsupported or missing manifest schema")
    if data.get("algorithm") != "sha256":
        raise LedgerError("Only sha256 manifests are supported")
    created_at = data.get("created_at")
    if not isinstance(created_at, str) or not created_at:
        raise LedgerError("Missing created_at")
    patterns = _patterns(data.get("excludes"))
    raw_files, skipped = data.get("files"), data.get("skipped")
    if not isinstance(raw_files, list) or not isinstance(skipped, list):
        raise LedgerError("files and skipped must be lists")
    entries: list[FileEntry] = []
    seen: set[str] = set()
    for item in raw_files:
        if not isinstance(item, dict) or not _valid_path(item.get("path")):
            raise LedgerError("Invalid relative file path")
        path, size, digest = item["path"], item.get("size"), item.get("sha256")
        if path in seen:
            raise LedgerError(f"Duplicate path: {path!r}")
        if type(size) is not int or size < 0:
            raise LedgerError(f"Invalid size for {path!r}")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise LedgerError(f"Invalid sha256 for {path!r}")
        entries.append(FileEntry(path, size, digest))
        seen.add(path)
    for path in skipped:
        if not _valid_path(path) or path in seen:
            raise LedgerError("Invalid or duplicate skipped path")
        seen.add(path)
    return Manifest(created_at, patterns, tuple(sorted(entries, key=lambda e: e.path)),
                    tuple(sorted(skipped)))


def _identity(info: os.stat_result) -> tuple[int, int, int, int]:
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns


def _linked(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0)
        & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    )


def _hash_file(path: Path, relative: str, before: os.stat_result) -> FileEntry:
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        opened = os.fstat(stream.fileno())
        if not stat.S_ISREG(opened.st_mode) or _identity(opened) != _identity(before):
            raise LedgerError(f"File changed before reading: {relative!r}; retry when idle")
        digest = hashlib.sha256()
        while chunk := stream.read(CHUNK_SIZE):
            digest.update(chunk)
        after = os.fstat(stream.fileno())
    current = path.lstat()
    if (_identity(before) != _identity(after) or _identity(before) != _identity(current)
            or _linked(current)):
        raise LedgerError(f"File changed while reading: {relative!r}; retry when idle")
    return FileEntry(relative, before.st_size, digest.hexdigest())


def snapshot(root: Path, excludes: tuple[str, ...] = ()) -> Manifest:
    """Hash regular files, explicitly listing links and special files as skipped.

    This is an ordinary directory traversal, not an atomic filesystem snapshot.
    Use an idle directory that untrusted processes cannot modify.
    """
    root = Path(root).resolve()
    if not root.is_dir():
        raise LedgerError("Scan root must be an existing directory")
    patterns = _patterns(excludes)
    entries: list[FileEntry] = []
    skipped: list[str] = []

    def walk(directory: Path) -> None:
        try:
            with os.scandir(directory) as iterator:
                children = sorted(iterator, key=lambda e: e.name)
        except OSError as exc:
            raise LedgerError(f"Cannot list directory: {directory.relative_to(root)!s}") from exc
        for child in children:
            path = Path(child.path)
            relative = path.relative_to(root).as_posix()
            if any(fnmatch.fnmatchcase(relative, p) for p in patterns):
                continue
            if not _valid_path(relative):
                raise LedgerError(f"Filename is not portable: {relative!r}")
            try:
                info = path.lstat()
                if stat.S_ISDIR(info.st_mode) and any(
                    fnmatch.fnmatchcase(relative + "/", p) for p in patterns
                ):
                    continue
                if _linked(info):
                    skipped.append(relative)
                elif stat.S_ISDIR(info.st_mode):
                    walk(path)
                elif stat.S_ISREG(info.st_mode):
                    entries.append(_hash_file(path, relative, info))
                else:
                    skipped.append(relative)
            except OSError as exc:
                raise LedgerError(f"Cannot read {relative!r}: {exc.strerror}") from exc

    walk(root)
    return Manifest(datetime.now(timezone.utc).isoformat(), patterns,
                    tuple(sorted(entries, key=lambda e: e.path)), tuple(sorted(skipped)))


def compare(before: Manifest, after: Manifest) -> dict[str, Any]:
    """Compare paths and bytes; ambiguous renames are reported as groups."""
    if set(before.excludes) != set(after.excludes):
        raise LedgerError("Exclusion scopes differ; create manifests with the same excludes")
    old, new = {e.path: e for e in before.files}, {e.path: e for e in after.files}
    missing, added = sorted(old.keys() - new.keys()), sorted(new.keys() - old.keys())
    common = sorted(old.keys() & new.keys())
    changed = [p for p in common if old[p] != new[p]]
    unchanged = [p for p in common if old[p] == new[p]]
    old_groups: dict[tuple[int, str], list[str]] = defaultdict(list)
    new_groups: dict[tuple[int, str], list[str]] = defaultdict(list)
    for paths, source, groups in ((missing, old, old_groups), (added, new, new_groups)):
        for path in paths:
            entry = source[path]
            groups[(entry.size, entry.sha256)].append(path)
    hints = [{"missing": old_groups[key], "added": new_groups[key]}
             for key in sorted(old_groups.keys() & new_groups.keys())]
    complete = not before.skipped and not after.skipped
    return {
        "schema": "file-ledger/report-v1", "command": "diff",
        "matches": not (missing or added or changed) and complete,
        "complete": complete, "excludes": list(before.excludes),
        "counts": {"unchanged": len(unchanged), "changed": len(changed),
                   "missing": len(missing), "added": len(added)},
        "unchanged": unchanged, "changed": changed, "missing": missing, "added": added,
        "rename_hints": hints,
        "skipped": {"before": list(before.skipped), "after": list(after.skipped)},
    }


def duplicates(manifest: Manifest) -> list[dict[str, Any]]:
    """List equal-content paths. Byte savings are a path-level upper bound."""
    grouped: dict[tuple[int, str], list[str]] = defaultdict(list)
    for entry in manifest.files:
        grouped[(entry.size, entry.sha256)].append(entry.path)
    groups = [{"sha256": digest, "size": size, "paths": sorted(paths),
               "reclaimable_bytes": size * (len(paths) - 1)}
              for (size, digest), paths in grouped.items() if len(paths) > 1]
    return sorted(groups, key=lambda group: (-group["reclaimable_bytes"], group["paths"]))
