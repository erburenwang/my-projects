"""Build a reproducible, standard-library-only .pyz executable."""

import argparse
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "file-ledger.pyz")
    args = parser.parse_args()
    target = args.output.resolve()
    if target.suffix != ".pyz":
        parser.error("Output must have a .pyz extension")
    sources = {"__main__.py": b"from file_ledger.cli import main\nraise SystemExit(main())\n",
               "LICENSE": (ROOT / "LICENSE").read_bytes()}
    for path in sorted((ROOT / "file_ledger").glob("*.py")):
        sources[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(sources.items()):
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, content)
    print(f"Built {target.name} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
