import shutil
import subprocess
import unittest

import helpers  # noqa: F401  (puts tools/ on the path)
from roadkit_sync.layout import blob_sha, canonical_json, kind_of, local_rel, remote_path


class LayoutTest(unittest.TestCase):
    def test_known_paths(self):
        for path, kind in [("state/unity-3d.json", "state"), ("notes/x.json", "notes"), ("activity/x.json", "activity"),
                           ("review.json", "review"), ("hidden.json", "hidden"), ("roadmaps/go.json", "roadmap"),
                           ("roadmaps/work/golang/go-basics.json", "roadmap"), ("roadmaps/work/_section.json", "section")]:
            self.assertEqual(kind_of(path), kind, path)

    def test_refused_paths(self):
        for path in ["../state/x.json", "state/../x.json", "/state/x.json", "state/.x.json", "state/x.txt",
                     "roadmaps/Go.json", "roadmaps/a/b/c/d/x.json", "roadmaps/_section.json", "state/x.json/",
                     "state\\x.json", "roadkit-sync.json", "README.md", "state//x.json", "", None]:
            self.assertIsNone(kind_of(path), path)

    def test_local_names(self):
        self.assertEqual(local_rel("state/a.json"), "a.json")
        self.assertEqual(local_rel("hidden.json"), "_hidden.json")
        self.assertEqual(remote_path("a.json"), "state/a.json")
        self.assertEqual(remote_path("_hidden.json"), "hidden.json")
        self.assertEqual(remote_path("notes/a.json"), "notes/a.json")
        self.assertIsNone(remote_path("_sync/base.json"))
        self.assertIsNone(remote_path("roadmaps/.tmp-x.json"))

    def test_canonical_json_is_stable(self):
        self.assertEqual(canonical_json({"b": 1, "a": "ç"}), canonical_json({"a": "ç", "b": 1}))
        self.assertTrue(canonical_json({}).endswith(b"\n"))

    @unittest.skipUnless(shutil.which("git"), "git not installed")
    def test_blob_sha_matches_git(self):
        data = canonical_json({"a": [1, 2, "três"]})
        out = subprocess.run(["git", "hash-object", "--stdin"], input=data, capture_output=True, check=True)
        self.assertEqual(blob_sha(data), out.stdout.decode().strip())


if __name__ == "__main__":
    unittest.main()
