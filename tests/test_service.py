import json
import unittest

from helpers import MemoryProvider, get, make_store, put
from roadkit_sync.errors import AuthError
from roadkit_sync.pairing import Pairing
from roadkit_sync.service import PUSH_DELAY, ServiceError, SyncService

TOKEN = "github_pat_SECRET_VALUE_123"
DEST = {"provider": "github", "owner": "me", "repo": "data", "branch": "main", "folder": "roadkit"}


class Clock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def __call__(self):
        return self.t


class FakeRepo(MemoryProvider):
    def __init__(self, private=True, fail=None):
        super().__init__()
        self.private, self.fail = private, fail

    def check(self):
        if self.fail:
            raise self.fail
        return {"repoId": 7, "private": self.private, "tokenKind": "fine-grained", "tokenExpires": "2030-01-01T00:00:00+00:00"}


class PairingTest(unittest.TestCase):
    def setUp(self):
        self.lines, self.now = [], [0.0]
        self.p = Pairing(out=lambda m, **kw: self.lines.append(m), clock=lambda: self.now[0])

    def code(self):
        return self.lines[-1].split("code ")[1].split()[0]

    def test_code_goes_to_the_log_and_is_used_once(self):
        self.assertTrue(self.p.new_code())
        code = self.code()
        ticket, _ = self.p.unlock(code)
        self.assertTrue(self.p.allowed(ticket))
        self.assertIsNone(self.p.unlock(code))

    def test_wrong_guesses_burn_the_code(self):
        self.p.new_code()
        code = self.code()
        for _ in range(5):
            self.assertIsNone(self.p.unlock("000000" if code != "000000" else "111111"))
        self.assertIsNone(self.p.unlock(code))

    def test_codes_and_tickets_expire(self):
        self.p.new_code()
        code = self.code()
        self.now[0] += 601
        self.assertIsNone(self.p.unlock(code))
        self.now[0] += 31
        self.p.new_code()
        ticket, ttl = self.p.unlock(self.code())
        self.now[0] += ttl + 1
        self.assertFalse(self.p.allowed(ticket))

    def test_no_flood_of_codes(self):
        self.assertTrue(self.p.new_code())
        self.assertFalse(self.p.new_code())


class ServiceTest(unittest.TestCase):
    def setUp(self):
        self.store = make_store()
        self.addCleanup(self.store._tmp.cleanup)
        self.repo = FakeRepo()
        self.clock = Clock()
        self.log = []
        self.env = {}
        self.svc = SyncService(self.store, env=self.env, clock=self.clock,
                               out=lambda m, **kw: self.log.append(m), provider_factory=lambda d, t: self.repo)

    def ticket(self):
        self.svc.pairing._last_new = None
        self.svc.pair()
        code = self.log[-1].split("code ")[1].split()[0]
        return self.svc.unlock(code)["ticket"]

    def setup(self, **kw):
        return self.svc.setup({**DEST, "token": TOKEN, "ticket": self.ticket(), **kw}, False)

    def test_setup_needs_pairing_or_the_api_token(self):
        with self.assertRaises(ServiceError) as e:
            self.svc.setup({**DEST, "token": TOKEN}, False)
        self.assertEqual(e.exception.status, 403)
        with self.assertRaises(ServiceError):
            self.svc.setup({**DEST, "token": TOKEN, "ticket": "guess"}, False)
        self.assertTrue(self.svc.setup({**DEST, "token": TOKEN}, True)["configured"])

    def test_token_never_leaves(self):
        info = self.setup()
        self.assertTrue(info["tokenSet"])
        self.assertNotIn(TOKEN, json.dumps(info))
        self.assertNotIn(TOKEN, json.dumps(self.svc.status()))
        self.assertNotIn(TOKEN, json.dumps(self.svc.config()))
        mode = (self.store.dir / "secret.json").stat().st_mode & 0o777
        self.assertEqual(json.loads((self.store.dir / "secret.json").read_text())["token"], TOKEN)
        self.assertTrue(mode in (0o600, 0o644))           # the test helper's write; the server's write_json makes 0600

    def test_bad_destinations_are_refused(self):
        for bad in ({"owner": "../x"}, {"folder": "/"}, {"folder": "../.."}, {"branch": "a..b"}, {"provider": "ftp"}):
            with self.assertRaises(ServiceError, msg=bad):
                self.setup(**bad)

    def test_public_repo_needs_confirmation_and_pauses_if_it_turns_public(self):
        self.repo.private = False
        with self.assertRaises(ServiceError) as e:
            self.setup()
        self.assertEqual(e.exception.status, 409)
        self.assertTrue(self.setup(publicAck=True)["publicAck"])
        self.repo.private = True
        self.setup()
        self.repo.private = False
        info = self.svc.run()
        self.assertEqual(info["status"]["state"], "paused")
        self.assertEqual(info["status"]["lastError"]["code"], "public")

    def test_env_token_wins_and_cannot_be_replaced(self):
        self.env["ROADKIT_SYNC_TOKEN"] = "github_pat_FROM_ENV"
        with self.assertRaises(ServiceError) as e:
            self.setup()
        self.assertEqual(e.exception.status, 409)
        info = self.svc.setup({**DEST, "ticket": self.ticket()}, False)
        self.assertEqual(info["tokenSource"], "env")

    def test_mode_change_needs_no_pairing_but_a_destination(self):
        with self.assertRaises(ServiceError):
            self.svc.set_mode({"mode": "auto"})
        self.setup()
        self.assertEqual(self.svc.set_mode({"mode": "auto"})["mode"], "auto")
        with self.assertRaises(ServiceError):
            self.svc.set_mode({"label": "<script>"})

    def test_run_and_status(self):
        put(self.store, "x.json", {"updatedAt": 1, "state": {"nodes": {}, "tasks": {}}})
        self.setup()
        info = self.svc.run()
        self.assertEqual(info["status"]["state"], "ok")
        self.assertIn("state/x.json", self.repo.files)

    def test_auth_error_pauses(self):
        self.setup()
        self.repo.fail = AuthError("token expired")
        info = self.svc.run()
        self.assertEqual(info["status"]["state"], "paused")

    def test_automatic_mode_sends_after_a_quiet_moment(self):
        self.setup(mode="auto")
        self.svc._next_pull = None
        put(self.store, "x.json", {"updatedAt": 1, "state": {"nodes": {}, "tasks": {}}})
        self.svc.notify_change()
        self.svc.tick()
        self.assertNotIn("state/x.json", self.repo.files)
        self.clock.t += PUSH_DELAY + 1
        self.svc.tick()
        self.assertIn("state/x.json", self.repo.files)

    def test_first_sync_with_both_sides_asks_then_merges(self):
        self.repo.files["state/y.json"] = b'{"state": {"nodes": {}, "tasks": {}}, "updatedAt": 1}\n'
        self.repo.rev = "r0"
        put(self.store, "x.json", {"updatedAt": 1, "state": {"nodes": {}, "tasks": {}}})
        self.setup()
        info = self.svc.run()
        self.assertTrue(info["status"]["needsChoice"])
        info = self.svc.run("sync", "merge")
        self.assertEqual(info["status"]["state"], "ok")
        self.assertIsNotNone(get(self.store, "y.json"))

    def test_disconnect_forgets_everything_but_the_data(self):
        put(self.store, "x.json", {"updatedAt": 1, "state": {"nodes": {}, "tasks": {}}})
        self.setup()
        self.svc.run()
        info = self.svc.disconnect()
        self.assertFalse(info["configured"] or info["tokenSet"])
        self.assertFalse((self.store.dir / "secret.json").exists())
        self.assertIsNotNone(get(self.store, "x.json"))


if __name__ == "__main__":
    unittest.main()
