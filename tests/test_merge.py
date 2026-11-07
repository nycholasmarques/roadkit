import unittest

import helpers  # noqa: F401
from roadkit_sync.merge import merge, merge_activity, merge_hidden, merge_state


class MergeTest(unittest.TestCase):
    def test_state_newer_wins_and_keeps_unknown_parts(self):
        old = {"updatedAt": 1, "state": {"nodes": {"a": "finished"}, "tasks": {}, "projects": {"p": {"status": "working"}}}}
        new = {"updatedAt": 2, "state": {"nodes": {"b": "working"}, "tasks": {}}}
        out = merge_state(None, old, new)
        self.assertEqual(out["updatedAt"], 2)
        self.assertEqual(out["state"]["nodes"], {"b": "working"})
        self.assertEqual(out["state"]["projects"], {"p": {"status": "working"}})
        self.assertEqual(merge_state(None, new, old), out)          # symmetric

    def test_tie_is_decided_the_same_on_both_sides(self):
        a = {"updatedAt": 5, "notes": {"roadmap": "a"}}
        b = {"updatedAt": 5, "notes": {"roadmap": "b"}}
        self.assertEqual(merge("notes", None, a, b)[0], merge("notes", None, b, a)[0])

    def test_activity_adds_what_each_side_did(self):
        base = {"v": 1, "days": {"2026-11-01": {"moves": 2, "focus": 30}}, "months": {},
                "topics": {"a": {"touched": 10, "started": "2026-11-01", "focus": 30, "sessions": 1}}}
        local = {"v": 1, "days": {"2026-11-01": {"moves": 3, "focus": 90}}, "months": {},
                 "topics": {"a": {"touched": 20, "started": "2026-11-01", "focus": 90, "sessions": 2}}}
        remote = {"v": 1, "days": {"2026-11-01": {"moves": 2, "focus": 60}, "2026-11-02": {"done": 1}}, "months": {},
                  "topics": {"a": {"touched": 15, "started": "2026-11-01", "finished": "2026-11-02", "focus": 60, "sessions": 2}}}
        out = merge_activity(base, local, remote)
        self.assertEqual(out["days"], {"2026-11-01": {"moves": 3, "focus": 120}, "2026-11-02": {"done": 1}})
        self.assertEqual(out["topics"]["a"], {"touched": 20, "started": "2026-11-01", "finished": "2026-11-02",
                                              "focus": 120, "sessions": 3})
        self.assertEqual(merge_activity(base, remote, local), out)

    def test_activity_merge_is_idempotent(self):
        base = {"v": 1, "days": {"2026-11-01": {"moves": 1}}, "months": {}, "topics": {}}
        local = {"v": 1, "days": {"2026-11-01": {"moves": 4}}, "months": {}, "topics": {}}
        once = merge_activity(base, local, base)
        self.assertEqual(once["days"]["2026-11-01"]["moves"], 4)
        self.assertEqual(merge_activity(once, once, once), once)

    def test_first_sync_does_not_double_shared_history(self):
        a = {"v": 1, "days": {"2026-11-01": {"moves": 5}}, "months": {}, "topics": {}}
        b = {"v": 1, "days": {"2026-11-01": {"moves": 3}, "2026-11-02": {"moves": 1}}, "months": {}, "topics": {}}
        out = merge_activity(None, a, b)
        self.assertEqual(out["days"], {"2026-11-01": {"moves": 5}, "2026-11-02": {"moves": 1}})

    def test_activity_reset_on_one_side_wins_over_unchanged(self):
        base = {"v": 1, "days": {}, "months": {}, "topics": {"a": {"touched": 1, "started": "2026-11-01"}}}
        local = {"v": 1, "days": {}, "months": {}, "topics": {"a": {"touched": 1}}}
        out = merge_activity(base, local, base)
        self.assertNotIn("started", out["topics"]["a"])

    def test_hidden_is_a_set(self):
        self.assertEqual(merge_hidden(["a", "b"], ["a", "b", "c"], ["b"]), ["b", "c"])

    def test_roadmap_keeps_local_and_flags_conflict(self):
        out, conflict = merge("roadmap", None, {"id": "x", "v": 1}, {"id": "x", "v": 2})
        self.assertEqual(out, {"id": "x", "v": 1})
        self.assertTrue(conflict)


if __name__ == "__main__":
    unittest.main()
