"""Command line interface and guarded artifact output."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from . import __version__
from .core import LedgerError, Manifest, compare, duplicates, parse_manifest, snapshot
from .report import render_report


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise LedgerError(f"Duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _load(path: str) -> Manifest:
    text = Path(path).read_text(encoding="utf-8-sig")
    try:
        data = json.loads(text, object_pairs_hook=_unique_object)
    except (ValueError, RecursionError) as exc:
        raise LedgerError(f"Invalid JSON manifest: {exc}") from exc
    return parse_manifest(data)


def _output_path(value: str, roots: tuple[Path, ...], inputs: tuple[Path, ...],
                 force: bool) -> Path:
    supplied = Path(value).expanduser().absolute()
    if supplied.is_symlink():
        raise LedgerError("Output must not be a symbolic link")
    target = supplied.resolve()
    if any(target.is_relative_to(root.resolve()) for root in roots):
        raise LedgerError("Save output outside the scanned directory to protect source files")
    if any(target == path.resolve() for path in inputs):
        raise LedgerError("Output must not overwrite an input manifest")
    if target.exists() and not force:
        raise LedgerError("Output already exists; choose a new path or use --force")
    if not target.parent.is_dir():
        raise LedgerError("Output parent directory does not exist")
    return target


def _write(path: Path, text: str, force: bool) -> None:
    content = text.encode("utf-8")
    if not force:
        # Exclusive creation also catches a file created after the preflight check.
        with path.open("xb") as output:
            try:
                output.write(content)
            except BaseException:
                output.close()
                path.unlink(missing_ok=True)
                raise
        return
    # Replacing a directory entry cannot truncate a hardlinked source file.
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".file-ledger-",
                                         delete=False) as output:
            temporary = Path(output.name)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _summary(manifest: Manifest, command: str) -> dict[str, Any]:
    return {
        "schema": "file-ledger/report-v1", "command": command,
        "complete": not manifest.skipped, "file_count": len(manifest.files),
        "total_bytes": sum(e.size for e in manifest.files),
        "excludes": list(manifest.excludes), "skipped": list(manifest.skipped),
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="file-ledger", description="Offline SHA-256 file handoff verification (Python 3.10+).")
    parser.add_argument("--version", action="version", version=f"file-ledger {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)
    for command, help_text in (
        ("snapshot", "Create a JSON manifest of a directory"),
        ("verify", "Check a directory against a saved manifest"),
        ("diff", "Compare two saved manifests without rescanning"),
        ("duplicates", "List equal-content files; never delete anything"),
    ):
        child = sub.add_parser(command, help=help_text, description=help_text)
        if command == "verify":
            child.add_argument("manifest", help="Expected JSON manifest")
        if command == "diff":
            child.add_argument("before")
            child.add_argument("after")
        else:
            child.add_argument("directory", type=Path)
        if command in ("snapshot", "duplicates"):
            child.add_argument("--exclude", action="append", default=[], metavar="PATTERN",
                               help="Case-sensitive fnmatch against relative POSIX paths; repeatable")
        if command == "snapshot":
            child.add_argument("-o", "--output", required=True, help="Manifest path outside source directory")
        else:
            child.add_argument("--report", help="Save report outside source directory (Markdown, or JSON with --json)")
        child.add_argument("--json", action="store_true", help="Print a JSON report instead of Markdown")
        child.add_argument("--force", action="store_true", help="Replace only the explicit output artifact")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        roots = () if args.command == "diff" else (args.directory,)
        inputs = ((Path(args.manifest),) if args.command == "verify" else
                  (Path(args.before), Path(args.after)) if args.command == "diff" else ())
        requested = args.output if args.command == "snapshot" else args.report
        target = _output_path(requested, roots, inputs, args.force) if requested else None
        if args.command == "snapshot":
            manifest = snapshot(args.directory, tuple(args.exclude))
            report = _summary(manifest, "snapshot")
            _write(target, json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2) + "\n", args.force)
        elif args.command == "verify":
            before = _load(args.manifest)
            report = compare(before, snapshot(args.directory, before.excludes))
            report["command"] = "verify"
        elif args.command == "diff":
            report = compare(_load(args.before), _load(args.after))
        else:
            manifest = snapshot(args.directory, tuple(args.exclude))
            report = _summary(manifest, "duplicates")
            report["groups"] = duplicates(manifest)
            report["reclaimable_bytes"] = sum(g["reclaimable_bytes"] for g in report["groups"])
        rendered = (json.dumps(report, ensure_ascii=False, indent=2) + "\n" if args.json
                    else render_report(report))
        if args.command != "snapshot" and target:
            _write(target, rendered, args.force)
        print(rendered, end="")
        if not report["complete"]:
            return 3
        return 1 if report.get("matches") is False else 0
    except (LedgerError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"file-ledger: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("file-ledger: interrupted", file=sys.stderr)
        return 130
