"""The sync with the server's real data folder, lock, atomic write and validators."""
import importlib
import json
import os
import tempfile
import unittest
from pathlib import Path

from helpers import MemoryProvider
from roadkit_sync.engine import SyncEngine
from roadkit_sync.layout import canonical_json


class ServerStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        os.environ["ROADKIT_DATA"] = self.tmp.name
        import roadkit
        self.rk = importlib.reload(roadkit)
        self.addCleanup(os.environ.pop, "ROADKIT_DATA", None)
        self.repo = MemoryProvider()
        self.engine = SyncEngine(self.rk.sync_store(), self.repo, device="t", compact=self.rk.compact_activity)

    def remote(self, path, obj):
        self.repo.files[path] = obj if isinstance(obj, bytes) else canonical_json(obj)
        self.repo.rev = f"x{len(self.repo.files)}"

    def test_valid_files_land_where_the_server_reads_them(self):
        roadmap = {"id": "go-basics", "meta": {"title": "Go"}, "phases": [{"id": "p1", "title": "P"}],
                   "nodes": [{"id": "n1", "title": "N", "phase": "p1", "summary": "s", "challenge": "c", "success": "s",
                              "links": [{"title": "Go", "url": "https://go.dev"}]}]}
        self.remote("roadmaps/estudos/go-basics.json", roadmap)
        self.remote("roadmaps/estudos/_section.json", {"title": "Estudos"})
        self.remote("state/go-basics.json", {"updatedAt": 1, "state": {"nodes": {"n1": "finished"}, "tasks": {}}})
        self.remote("hidden.json", ["unity-gamedev"])
        self.remote("activity/go-basics.json", {"v": 1, "days": {"2026-11-01": {"moves": 1, "done": 1}}, "months": {},
                                                "topics": {"n1": {"touched": 1, "started": "2026-11-01", "finished": "2026-11-01"}}})
        r = self.engine.run()
        self.assertEqual(r.skipped, [])
        data = Path(self.tmp.name)
        self.assertTrue((data / "roadmaps/estudos/go-basics.json").is_file())
        self.assertEqual(self.rk.read_hidden(), {"unity-gamedev"})
        self.assertEqual(self.rk.read_activity("go-basics")["days"], {"2026-11-01": {"moves": 1, "done": 1}})
        self.assertIn("go-basics", self.rk.known_ids())

    def test_malicious_files_are_refused(self):
        bad_roadmap = {"id": "evil", "meta": {"title": "E"}, "phases": [{"id": "p", "title": "P"}],
                       "nodes": [{"id": "n", "title": "N", "phase": "p", "links": [{"title": "x", "url": "javascript:alert(1)"}]}]}
        self.remote("roadmaps/evil.json", bad_roadmap)
        self.remote("roadmaps/other.json", {**bad_roadmap, "id": "not-other"})
        self.remote("state/x.json", {"updatedAt": 1, "state": {"nodes": {"a": "done-ish"}}})
        self.remote("notes/x.json", {"updatedAt": 1, "notes": {"../x": "y"}})
        self.remote("activity/x.json", {"days": {"yesterday": {"moves": -1}}})
        self.remote("hidden.json", ["../../etc"])
        r = self.engine.run()
        self.assertEqual(len(r.skipped), 6, r.skipped)
        self.assertEqual(sorted(p.name for p in Path(self.tmp.name).rglob("*.json") if "_sync" not in p.parts), [])

    def test_local_progress_goes_up_in_canonical_form(self):
        self.rk.write_json(Path(self.tmp.name) / "x.json", {"updatedAt": 1, "state": {"tasks": {}, "nodes": {"b": "todo"}}})
        self.engine.run()
        self.assertEqual(json.loads(self.repo.files["state/x.json"])["state"]["nodes"], {"b": "todo"})
        self.assertEqual(self.repo.files["state/x.json"], canonical_json(json.loads(self.repo.files["state/x.json"])))
        mode = (Path(self.tmp.name) / "_sync" / "base.json").stat().st_mode & 0o777
        self.assertEqual(mode, 0o600)


if __name__ == "__main__":
    unittest.main()
