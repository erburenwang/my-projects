import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / "交付 资料"
        self.root.mkdir()
        (self.root / "合同.txt").write_bytes(b"original")
        self.manifest = self.base / "清单.json"

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, "-m", "file_ledger", *map(str, args)],
            cwd=PROJECT, capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}, timeout=20,
        )

    def take_snapshot(self, *args):
        result = self.run_cli("snapshot", self.root, "-o", self.manifest, "--json", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_snapshot_then_verify_and_report_real_changes(self):
        self.assertEqual(self.take_snapshot()["file_count"], 1)
        matched = self.run_cli("verify", self.manifest, self.root, "--json")
        self.assertEqual(matched.returncode, 0, matched.stderr)
        self.assertTrue(json.loads(matched.stdout)["matches"])
        (self.root / "合同.txt").write_bytes(b"modified")
        (self.root / "new.txt").write_bytes(b"new")
        report = self.base / "report.md"
        changed = self.run_cli("verify", self.manifest, self.root, "--report", report)
        self.assertEqual(changed.returncode, 1, changed.stderr)
        self.assertIn("合同.txt", report.read_text(encoding="utf-8"))
        self.assertIn("new.txt", changed.stdout)
        self.assertEqual((self.root / "合同.txt").read_bytes(), b"modified")

    def test_excluded_scope_is_reused_automatically_by_verify(self):
        (self.root / "cache.tmp").write_bytes(b"cache")
        self.take_snapshot("--exclude", "*.tmp")
        (self.root / "cache.tmp").write_bytes(b"changed")
        checked = self.run_cli("verify", self.manifest, self.root, "--json")
        self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertEqual(json.loads(checked.stdout)["excludes"], ["*.tmp"])

    def test_existing_output_is_preserved_without_force(self):
        self.manifest.write_text("do not replace", encoding="utf-8")
        result = self.run_cli("snapshot", self.root, "-o", self.manifest)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.manifest.read_text(), "do not replace")

    def test_outputs_inside_source_are_refused_even_with_force(self):
        source = self.root / "合同.txt"
        result = self.run_cli("snapshot", self.root, "-o", source, "--force")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(source.read_bytes(), b"original")
        self.assertEqual(len(list(self.root.iterdir())), 1)

    def test_report_cannot_overwrite_manifest_input(self):
        self.take_snapshot()
        before = self.manifest.read_bytes()
        result = self.run_cli("verify", self.manifest, self.root,
                              "--report", self.manifest, "--force")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.manifest.read_bytes(), before)

    def test_force_output_replaces_hardlink_without_modifying_source(self):
        try:
            os.link(self.root / "合同.txt", self.manifest)
        except OSError:
            self.skipTest("Hardlinks unavailable on this filesystem")
        self.take_snapshot("--force")
        self.assertEqual((self.root / "合同.txt").read_bytes(), b"original")
        self.assertEqual(json.loads(self.manifest.read_text(encoding="utf-8"))["schema"],
                         "file-ledger/v1")

    def test_bad_json_schema_and_missing_root_fail_without_report(self):
        report = self.base / "report.md"
        for content in ("not json", "{}", "[]", '{"schema":"x","schema":"y"}'):
            self.manifest.write_text(content, encoding="utf-8")
            result = self.run_cli("verify", self.manifest, self.root, "--report", report)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn("Traceback", result.stderr)
            self.assertFalse(report.exists())
        result = self.run_cli("snapshot", self.base / "missing", "-o", self.base / "out.json")
        self.assertEqual(result.returncode, 2)
        self.assertFalse((self.base / "out.json").exists())

    def test_diff_uses_manifests_without_the_original_directories(self):
        self.take_snapshot()
        (self.root / "合同.txt").rename(self.root / "改名.txt")
        after = self.base / "after.json"
        result = self.run_cli("snapshot", self.root, "-o", after)
        self.assertEqual(result.returncode, 0, result.stderr)
        (self.root / "改名.txt").unlink()
        self.root.rmdir()
        result = self.run_cli("diff", self.manifest, after, "--json")
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(json.loads(result.stdout)["rename_hints"], [
            {"missing": ["合同.txt"], "added": ["改名.txt"]}
        ])

    def test_overlarge_integer_and_deep_json_are_input_errors(self):
        self.take_snapshot()
        bad = self.base / "bad.json"
        report = self.base / "bad-report.md"
        for content in ("9" * 5000, "[" * 10000 + "]" * 10000):
            bad.write_text(content, encoding="utf-8")
            for args in (("verify", bad, self.root), ("diff", self.manifest, bad)):
                with self.subTest(content_length=len(content), command=args[0]):
                    result = self.run_cli(*args, "--report", report)
                    self.assertEqual(result.returncode, 2, result.stderr)
                    self.assertNotIn("Traceback", result.stderr)
                    self.assertFalse(report.exists())

    def test_duplicates_report_is_informational_and_deletes_nothing(self):
        (self.root / "副本.txt").write_bytes(b"original")
        result = self.run_cli("duplicates", self.root, "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["groups"][0]["reclaimable_bytes"], 8)
        self.assertEqual(len(list(self.root.iterdir())), 2)

    def test_empty_scan_is_reported_with_zero_count(self):
        (self.root / "合同.txt").unlink()
        report = self.take_snapshot()
        self.assertEqual(report["file_count"], 0)
        self.assertTrue(report["complete"])

    def test_excluded_everything_is_visible_in_summary(self):
        report = self.take_snapshot("--exclude", "*")
        self.assertEqual(report["file_count"], 0)
        self.assertEqual(report["excludes"], ["*"])

    @unittest.skipUnless(os.name == "nt", "Windows junction behavior")
    def test_windows_junction_is_skipped_with_incomplete_exit_code(self):
        outside = self.base / "outside"
        outside.mkdir()
        (outside / "private.txt").write_bytes(b"do not scan")
        link = self.root / "junction"
        created = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(outside)],
                                 capture_output=True)
        self.assertEqual(created.returncode, 0, created.stderr)
        self.addCleanup(lambda: link.rmdir() if link.exists() else None)
        result = self.run_cli("snapshot", self.root, "-o", self.manifest, "--json")
        self.assertEqual(result.returncode, 3, result.stderr)
        self.assertEqual(json.loads(result.stdout)["skipped"], ["junction"])
        data = json.loads(self.manifest.read_text(encoding="utf-8"))
        self.assertEqual([e["path"] for e in data["files"]], ["合同.txt"])
        verify = self.run_cli("verify", self.manifest, self.root, "--json")
        self.assertEqual(verify.returncode, 3, verify.stderr)

    def test_version_and_help_are_usable(self):
        version = self.run_cli("--version")
        self.assertEqual(version.returncode, 0, version.stderr)
        self.assertIn("1.0.0", version.stdout)
        help_result = self.run_cli("--help")
        self.assertEqual(help_result.returncode, 0)
        for command in ("snapshot", "verify", "diff", "duplicates"):
            self.assertIn(command, help_result.stdout)


class ReportTests(unittest.TestCase):
    def test_markdown_escapes_active_html_and_newline_in_filenames(self):
        from markdown_it import MarkdownIt
        from file_ledger.report import render_report

        text = render_report({
            "command": "diff", "matches": False, "complete": True, "excludes": [],
            "counts": {"unchanged": 0, "changed": 0, "missing": 1, "added": 0},
            "unchanged": [], "changed": [], "added": [],
            "missing": ["<script>alert(1)</script>\n# forged"],
            "rename_hints": [], "skipped": {"before": [], "after": []},
        })
        rendered = MarkdownIt("commonmark").render(text)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn("\n# forged", text)
        self.assertIn("&lt;script&gt;", rendered)

    def test_rendered_names_and_patterns_remain_literal_text(self):
        from html.parser import HTMLParser
        from markdown_it import MarkdownIt
        from file_ledger.report import render_report

        class CodeText(HTMLParser):
            def __init__(self):
                super().__init__(convert_charrefs=True)
                self.inside_code = False
                self.code_text = []
                self.active_tags = []

            def handle_starttag(self, tag, attrs):
                if tag == "code":
                    self.inside_code = True
                    self.code_text.append("")
                if tag in ("a", "img", "em", "script"):
                    self.active_tags.append(tag)

            def handle_endtag(self, tag):
                if tag == "code":
                    self.inside_code = False

            def handle_data(self, data):
                if self.inside_code:
                    self.code_text[-1] += data

        names = ["[trusted file](other-file.txt)", "![remote](https://example.invalid/track.png)",
                 "*emphasis*", "**bold**", "`tick` and ``double``", "a|b", " leading ", "   "]
        report = render_report({
            "command": "diff", "matches": False, "complete": True, "excludes": names,
            "counts": {"unchanged": 0, "changed": 0, "missing": len(names), "added": 0},
            "unchanged": [], "changed": [], "added": [], "missing": names,
            "rename_hints": [], "skipped": {"before": [], "after": []},
        })
        parsed = CodeText()
        parsed.feed(MarkdownIt("commonmark").render(report))
        self.assertEqual(parsed.active_tags, [])
        for name in names:
            self.assertEqual(parsed.code_text.count(name), 2)


if __name__ == "__main__":
    unittest.main()
