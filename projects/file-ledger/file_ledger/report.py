"""Small, shareable Markdown reports with escaped user-controlled names."""

from __future__ import annotations

import json
import re
from typing import Any


def _name(value: str) -> str:
    escaped = json.dumps(value, ensure_ascii=False)[1:-1]
    fence = "`" * (max((len(run) for run in re.findall(r"`+", escaped)), default=0) + 1)
    # A longer fence protects embedded backticks; padding preserves boundary ticks/spaces.
    pad = " " if not escaped.isspace() and escaped.startswith(("`", " ")) else ""
    if not escaped.isspace() and escaped.endswith(("`", " ")):
        pad = " "
    return fence + pad + escaped + pad + fence


def render_report(report: dict[str, Any]) -> str:
    command = report["command"]
    lines = [f"# File Ledger — {command}", ""]
    if not report["complete"]:
        lines += ["**INCOMPLETE — some entries were skipped; this is not a full verification.**", ""]
    if "matches" in report:
        lines += ["Result: **" + ("MATCH" if report["matches"] else "NOT A MATCH") + "**", ""]
        lines += ["| Unchanged | Changed | Missing | Added |", "| ---: | ---: | ---: | ---: |",
                  "| " + " | ".join(str(report["counts"][k]) for k in
                                      ("unchanged", "changed", "missing", "added")) + " |", ""]
        for key in ("changed", "missing", "added"):
            if report[key]:
                lines += [f"## {key.title()}", ""]
                lines += ["- " + _name(path) for path in report[key]] + [""]
        if report["rename_hints"]:
            lines += ["## Possible renames", "",
                      "Same-content groups are hints, not confirmed one-to-one renames.", ""]
            for hint in report["rename_hints"]:
                lines += ["- " + ", ".join(map(_name, hint["missing"])) + " → "
                          + ", ".join(map(_name, hint["added"]))]
            lines += [""]
        for side in ("before", "after"):
            if report["skipped"][side]:
                lines += [f"## Skipped ({side})", ""]
                lines += ["- " + _name(p) for p in report["skipped"][side]] + [""]
    else:
        lines += [f"Files scanned: **{report['file_count']}** · Bytes: **{report['total_bytes']}**", ""]
        if command == "duplicates":
            lines += [f"Duplicate groups: **{len(report['groups'])}**", "",
                      "Potential byte savings are an upper bound; hardlinks and compression affect disk usage.",
                      "No files were deleted.", ""]
            for group in report["groups"]:
                lines += [f"## {group['size']} bytes × {len(group['paths'])} paths", ""]
                lines += ["- " + _name(p) for p in group["paths"]] + [""]
        if report["skipped"]:
            lines += ["## Skipped", ""] + ["- " + _name(p) for p in report["skipped"]] + [""]
    lines += ["Exclusion patterns: " + (", ".join(map(_name, report["excludes"])) or "none"), "",
              "SHA-256 checks content equality. It does not prove the sender's identity.", ""]
    return "\n".join(lines)
