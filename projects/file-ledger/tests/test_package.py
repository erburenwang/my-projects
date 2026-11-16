import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]


class PackageTests(unittest.TestCase):
    def test_reproducible_zipapp_runs_outside_the_source_tree(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            artifacts = [root / "first.pyz", root / "second.pyz"]
            for target in artifacts:
                built = subprocess.run(
                    [sys.executable, str(PROJECT / "tools/build_zipapp.py"), "--output", str(target)],
                    cwd=root, capture_output=True, text=True,
                    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                    encoding="utf-8", timeout=20,
                )
                self.assertEqual(built.returncode, 0, built.stderr)
            self.assertEqual(artifacts[0].read_bytes(), artifacts[1].read_bytes())
            data = root / "data"
            data.mkdir()
            (data / "example.txt").write_bytes(b"abc")
            manifest = root / "manifest.json"
            saved = subprocess.run(
                [sys.executable, str(artifacts[0]), "snapshot", str(data), "-o", str(manifest)],
                cwd=root, capture_output=True, timeout=20,
            )
            self.assertEqual(saved.returncode, 0, saved.stderr)
            verified = subprocess.run(
                [sys.executable, str(artifacts[0]), "verify", str(manifest), str(data)],
                cwd=root, capture_output=True, timeout=20,
            )
            self.assertEqual(verified.returncode, 0, verified.stderr)
            (data / "example.txt").write_bytes(b"changed")
            changed = subprocess.run(
                [sys.executable, str(artifacts[0]), "verify", str(manifest), str(data)],
                cwd=root, capture_output=True, timeout=20,
            )
            self.assertEqual(changed.returncode, 1, changed.stderr)
