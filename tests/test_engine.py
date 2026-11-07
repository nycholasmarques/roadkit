import json
import unittest

from helpers import MemoryProvider, get, make_store, put
from roadkit_sync.engine import SyncEngine
from roadkit_sync.errors import Busy, NeedsChoice, RemoteFormat, Stale
from roadkit_sync.layout import canonical_json

STATE = lambda t, **nodes: {"updatedAt": t, "state": {"nodes": nodes, "tasks": {}}}


def only_valid_state(obj, path):
    ok = isinstance(obj, dict) and isinstance(obj.get("updatedAt"), int) and isinstance(obj.get("state"), dict)
    return None if ok else "invalid progress"


class EngineTest(unittest.TestCase):
    def setUp(self):
        self.repo = MemoryProvider()
        self.a, self.b = make_store({"state": only_valid_state}), make_store({"state": only_valid_state})
        self.ea = SyncEngine(self.a, self.repo, device="a")
        self.eb = SyncEngine(self.b, self.repo, device="b")
        self.addCleanup(self.a._tmp.cleanup)
        self.addCleanup(self.b._tmp.cleanup)

    def test_first_device_uploads_and_second_downloads(self):
        put(self.a, "unity.json", STATE(1, camera="finished"))
        put(self.a, "notes/unity.json", {"updatedAt": 1, "notes": {"roadmap": "oi"}})
        r = self.ea.run()
        self.assertEqual(r.pushed, ["notes/unity.json", "state/unity.json"])
        self.assertEqual(len(self.repo.commits), 1)
        self.assertIn("roadkit-sync.json", self.repo.files)
        r = self.eb.run()
        self.assertEqual(r.pulled, ["notes/unity.json", "state/unity.json"])
        self.assertEqual(get(self.b, "unity.json"), STATE(1, camera="finished"))
        self.assertEqual(len(self.repo.commits), 1)                 # pulling writes nothing

    def test_changes_on_both_sides_converge(self):
        put(self.a, "x.json", STATE(1, a="todo"))
        self.ea.run()
        self.eb.run()
        put(self.a, "x.json", STATE(5, a="finished"))
        put(self.b, "x.json", STATE(3, a="working"))
        put(self.b, "y.json", STATE(4, b="working"))
        self.eb.run()
        self.ea.run()
        self.eb.run()
        self.assertEqual(get(self.a, "x.json"), get(self.b, "x.json"))
        self.assertEqual(get(self.a, "x.json")["state"]["nodes"], {"a": "finished"})
        self.assertEqual(get(self.a, "y.json"), STATE(4, b="working"))
        n = len(self.repo.commits)
        self.ea.run(), self.eb.run()
        self.assertEqual(len(self.repo.commits), n)                 # nothing left to sync

    def test_deletion_reaches_the_other_device(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        self.eb.run()
        (self.a.data / "x.json").unlink()
        self.ea.run()
        self.assertNotIn("state/x.json", self.repo.files)
        self.eb.run()
        self.assertIsNone(get(self.b, "x.json"))

    def test_deleted_on_one_side_and_changed_on_the_other_is_kept(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        self.eb.run()
        (self.a.data / "x.json").unlink()
        put(self.b, "x.json", STATE(2, a="working"))
        self.eb.run()
        self.ea.run()
        self.assertEqual(get(self.a, "x.json"), STATE(2, a="working"))

    def test_first_sync_with_data_on_both_sides_asks(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        put(self.b, "y.json", STATE(1))
        with self.assertRaises(NeedsChoice):
            self.eb.run()
        self.eb.run(first="merge")
        self.assertIsNotNone(get(self.b, "x.json"))
        self.assertIn("state/y.json", self.repo.files)

    def test_first_sync_use_remote_replaces_local(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        put(self.b, "y.json", STATE(1))
        self.eb.run(first="remote")
        self.assertIsNone(get(self.b, "y.json"))
        self.assertIsNotNone(get(self.b, "x.json"))
        self.assertNotIn("state/y.json", self.repo.files)

    def test_first_sync_use_local_replaces_remote(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        put(self.b, "y.json", STATE(1))
        self.eb.run(first="local")
        self.assertNotIn("state/x.json", self.repo.files)
        self.assertIn("state/y.json", self.repo.files)
        self.assertIsNone(get(self.b, "x.json"))

    def test_invalid_remote_file_is_skipped_and_local_untouched(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        self.repo.files["state/x.json"] = b'{"updatedAt": "soon"}\n'
        self.repo.files["state/y.json"] = b"not json"
        self.repo.files["../escape.json"] = b"{}"
        self.repo.files["state/link.json"] = b"{}"
        r = self.ea.run()
        self.assertEqual(get(self.a, "x.json"), STATE(1))
        self.assertIsNone(get(self.a, "y.json"))
        self.assertFalse((self.a.data.parent / "escape.json").exists())
        self.assertEqual({s["path"] for s in r.skipped}, {"state/x.json", "state/y.json", "state/link.json"})

    def test_remote_moving_during_write_is_retried(self):
        put(self.a, "w.json", STATE(1))
        self.ea.run()
        put(self.a, "x.json", STATE(1))
        def other_device():
            self.repo.files["state/z.json"] = canonical_json(STATE(9))
            self.repo.rev = "other"
        self.repo.before_write = other_device
        self.ea.run()
        self.assertIn("state/x.json", self.repo.files)
        self.assertEqual(get(self.a, "z.json"), STATE(9))

    def test_local_change_during_sync_is_merged_again(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run()
        put(self.b, "x.json", STATE(1))
        self.eb.run(first="merge")
        self.repo.files["state/x.json"] = canonical_json(STATE(2, a="working"))
        self.repo.rev = "moved"
        real_apply, calls = self.b.apply, []
        def apply(changes, expected):
            if not calls:
                calls.append(1)
                put(self.b, "x.json", STATE(3, a="finished"))       # you marked a topic meanwhile
                raise Stale("changed")
            return real_apply(changes, expected)
        self.b.apply = apply
        self.eb.run()
        self.assertEqual(get(self.b, "x.json"), STATE(3, a="finished"))
        self.assertEqual(json.loads(self.repo.files["state/x.json"]), STATE(3, a="finished"))

    def test_gives_up_when_the_data_never_settles(self):
        put(self.a, "x.json", STATE(1))
        self.b.apply = lambda changes, expected: (_ for _ in ()).throw(Stale("again"))
        self.ea.run()
        with self.assertRaises(Busy):
            self.eb.run()

    def test_newer_format_is_left_alone(self):
        self.repo.files["roadkit-sync.json"] = canonical_json({"format": 99})
        self.repo.rev = "r0"
        with self.assertRaises(RemoteFormat):
            self.ea.run()

    def test_push_and_pull_only(self):
        put(self.a, "x.json", STATE(1))
        self.ea.run(mode="pull")
        self.assertEqual(self.repo.files, {})
        self.ea.run(mode="push")
        self.assertIn("state/x.json", self.repo.files)
        self.repo.files["state/y.json"] = canonical_json(STATE(2))
        self.repo.rev = "x"
        put(self.a, "x.json", STATE(3))
        self.ea.run(mode="pull")
        self.assertEqual(get(self.a, "y.json"), STATE(2))
        self.assertEqual(json.loads(self.repo.files["state/x.json"]), STATE(1))
        self.ea.run()
        self.assertEqual(json.loads(self.repo.files["state/x.json"]), STATE(3))

    def test_sync_files_and_unknown_files_never_travel(self):
        put(self.a, "x.json", STATE(1))
        put(self.a, "_sync/config.json", {"secret": "nope"})
        (self.a.data / "notes").mkdir(exist_ok=True)
        (self.a.data / "notes" / ".tmp-1.json").write_text("{}")
        (self.a.data / "weird name.json").write_text("{}")
        self.ea.run()
        self.assertEqual(set(self.repo.files), {"roadkit-sync.json", "state/x.json"})


if __name__ == "__main__":
    unittest.main()
