import copy
import hashlib
import os
import tempfile
import unittest
from pathlib import Path

from file_ledger.core import LedgerError, compare, duplicates, parse_manifest, snapshot


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def put(self, name, content=b"abc"):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    def test_snapshot_hashes_nested_unicode_files_and_hidden_files(self):
        self.put("资料/合同.txt")
        self.put(".hidden", b"")
        result = snapshot(self.root)
        self.assertEqual([e.path for e in result.files], [".hidden", "资料/合同.txt"])
        self.assertEqual(result.files[1].sha256,
                         "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        self.assertEqual(result.files[0].size, 0)
        self.assertNotIn(str(self.root), str(result.to_dict()))
        self.assertEqual(parse_manifest(result.to_dict()), result)

    def test_empty_directory_is_valid(self):
        result = snapshot(self.root)
        self.assertEqual(result.files, ())
        self.assertEqual(result.skipped, ())

    def test_excludes_prune_directories_and_apply_to_nested_files(self):
        self.put("keep.txt")
        self.put("drafts/a.txt")
        self.put("nested/cache.tmp")
        result = snapshot(self.root, ("drafts/**", "*.tmp"))
        self.assertEqual([e.path for e in result.files], ["keep.txt"])
        self.assertEqual(result.excludes, ("drafts/**", "*.tmp"))

    def test_directory_exclusion_does_not_hide_a_file_with_the_same_name(self):
        self.put("drafts")
        self.assertEqual([e.path for e in snapshot(self.root, ("drafts/**",)).files], ["drafts"])

    def test_diff_distinguishes_missing_added_changed_and_unchanged(self):
        self.put("same.txt")
        self.put("change.txt", b"old")
        self.put("gone.txt", b"gone")
        before = snapshot(self.root)
        self.put("change.txt", b"new")  # same length, different content
        (self.root / "gone.txt").unlink()
        self.put("new.txt", b"added")
        result = compare(before, snapshot(self.root))
        self.assertEqual(result["unchanged"], ["same.txt"])
        self.assertEqual(result["changed"], ["change.txt"])
        self.assertEqual(result["missing"], ["gone.txt"])
        self.assertEqual(result["added"], ["new.txt"])
        self.assertFalse(result["matches"])

    def test_possible_rename_is_a_group_hint_not_a_success(self):
        self.put("a.txt")
        self.put("b.txt")
        before = snapshot(self.root)
        (self.root / "a.txt").rename(self.root / "c.txt")
        (self.root / "b.txt").rename(self.root / "d.txt")
        result = compare(before, snapshot(self.root))
        self.assertFalse(result["matches"])
        self.assertEqual(result["rename_hints"], [
            {"missing": ["a.txt", "b.txt"], "added": ["c.txt", "d.txt"]}
        ])

    def test_duplicates_group_by_content_and_count_reclaimable_bytes(self):
        self.put("a")
        self.put("nested/b")
        self.put("different", b"xyz")
        self.put("empty1", b"")
        self.put("empty2", b"")
        groups = duplicates(snapshot(self.root))
        self.assertEqual(groups[0]["paths"], ["a", "nested/b"])
        self.assertEqual(groups[0]["reclaimable_bytes"], 3)
        self.assertEqual(groups[1]["reclaimable_bytes"], 0)
        self.assertEqual(len(groups), 2)
        self.assertTrue((self.root / "nested/b").exists())

    def test_symlink_is_skipped_and_visible(self):
        target = self.put("original")
        try:
            os.symlink(target, self.root / "link")
        except (OSError, NotImplementedError):
            self.skipTest("Symlinks unavailable for this account")
        result = snapshot(self.root)
        self.assertEqual([e.path for e in result.files], ["original"])
        self.assertEqual(result.skipped, ("link",))

    def test_missing_root_is_an_error(self):
        with self.assertRaises(LedgerError):
            snapshot(self.root / "missing")

    def test_exclusion_scope_mismatch_is_rejected(self):
        with self.assertRaises(LedgerError):
            compare(snapshot(self.root), snapshot(self.root, ("*.tmp",)))

    def test_parser_rejects_bad_schema_paths_hashes_sizes_and_duplicates(self):
        self.put("normal")
        valid = snapshot(self.root).to_dict()
        bad_documents = [None, [], {}, {**valid, "schema": "unknown"},
                         {**valid, "algorithm": "md5"},
                         {**valid, "files": valid["files"] * 2},
                         {**valid, "excludes": "*.tmp"},
                         {**valid, "skipped": ["../bad"]}]
        for field, values in {
            "path": ["../escape", "/root", "C:/file", "a\\b", "a//b", "a/./b", "", "a\x00b"],
            "size": [-1, True, "3"],
            "sha256": ["bad", "g" * 64],
        }.items():
            for value in values:
                doc = copy.deepcopy(valid)
                doc["files"][0][field] = value
                bad_documents.append(doc)
        for document in bad_documents:
            with self.subTest(document=document):
                with self.assertRaises(LedgerError):
                    parse_manifest(document)

    def test_large_file_is_hashed_in_full(self):
        data = b"0123456789" * 250_000
        self.put("large.bin", data)
        self.assertEqual(snapshot(self.root).files[0].sha256,
                         hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    unittest.main()
