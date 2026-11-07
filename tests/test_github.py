import json
import ssl
import unittest

from fake_github import HAVE_OPENSSL, FakeGitHub
from helpers import get, make_store, put
from roadkit_sync.engine import SyncEngine
from roadkit_sync.errors import AuthError, NoAccess, SyncError, TooLarge
from roadkit_sync.github import GitHubProvider, valid_branch, valid_folder, valid_owner_repo
from roadkit_sync.layout import canonical_json
from roadkit_sync.net import SafeClient

STATE = lambda t, **nodes: {"updatedAt": t, "state": {"nodes": nodes, "tasks": {}}}


class NamesTest(unittest.TestCase):
    def test_names(self):
        self.assertTrue(valid_owner_repo("nycholasmarques", "roadmap-engine"))
        for o, r in [("..", "x"), ("a/b", "x"), ("a", "x?y"), ("a", ""), ("a", "x y")]:
            self.assertFalse(valid_owner_repo(o, r), (o, r))
        self.assertTrue(valid_branch("main") and valid_branch("feat/sync"))
        for b in ["../main", "a..b", "/main", "main/", "x.lock", "-x", ".x", "a//b", "a b", "a/.b"]:
            self.assertFalse(valid_branch(b), b)
        self.assertTrue(valid_folder("roadkit") and valid_folder("progress") and valid_folder("a/b"))
        for f in ["", "/", "..", "a/../b", ".roadkit", "a//b", "a/b/c/d/e/f", "/roadkit"]:
            self.assertFalse(valid_folder(f), f)

    def test_provider_refuses_bad_settings_before_any_request(self):
        with self.assertRaises(ValueError):
            GitHubProvider("github_pat_x", "me", "repo", "main", "")
        with self.assertRaises(AuthError):
            GitHubProvider("bad token", "me", "repo", "main", "roadkit")

    def test_only_https(self):
        with self.assertRaises(ValueError):
            SafeClient("t", "http://api.github.com")


@unittest.skipUnless(HAVE_OPENSSL, "openssl not installed")
class GitHubTest(unittest.TestCase):
    def setUp(self):
        self.gh = FakeGitHub()
        self.addCleanup(self.gh.close)

    def provider(self, token=None, folder="roadkit", **kw):
        client = SafeClient(token or self.gh.token, self.gh.base, ssl_context=self.gh.client_context(), **kw)
        return GitHubProvider(token or self.gh.token, self.gh.owner, self.gh.repo, "main", folder, client=client)

    def engine(self, store, device):
        return SyncEngine(store, self.provider(), device=device)

    def store(self):
        s = make_store()
        self.addCleanup(s._tmp.cleanup)
        return s

    def test_check(self):
        info = self.provider().check()
        self.assertEqual(info["fullName"], "me/data")
        self.assertTrue(info["private"] and info["empty"])
        self.assertEqual(info["tokenKind"], "fine-grained")
        self.assertTrue(info["tokenExpires"].startswith("2030-01-31"))
        self.gh.push = False
        with self.assertRaises(NoAccess):
            self.provider().check()

    def test_wrong_token_and_wrong_repo(self):
        with self.assertRaises(AuthError):
            self.provider(token="github_pat_WRONG").check()
        p = self.provider()
        p.repo = "other"
        with self.assertRaises(NoAccess):
            p.check()

    def test_empty_repo_then_two_devices(self):
        a, b = self.store(), self.store()
        put(a, "x.json", STATE(1, camera="finished"))
        put(a, "notes/x.json", {"updatedAt": 1, "notes": {"roadmap": "oi"}})
        self.engine(a, "a").run()
        files = self.gh.files()
        self.assertEqual(set(files), {"roadkit/roadkit-sync.json", "roadkit/state/x.json", "roadkit/notes/x.json"})
        self.engine(b, "b").run()
        self.assertEqual(get(b, "x.json"), STATE(1, camera="finished"))

    def test_one_commit_per_sync_and_nothing_outside_the_folder(self):
        self.gh.commit_files({"README.md": b"# mine\n", "roadmaps/go.json": b"{}\n"})
        a = self.store()
        put(a, "x.json", STATE(1))
        put(a, "y.json", STATE(1))
        put(a, "notes/x.json", {"updatedAt": 1, "notes": {}})
        before = len(self.gh.history())
        self.engine(a, "a").run()
        self.assertEqual(len(self.gh.history()), before + 1)
        files = self.gh.files()
        self.assertEqual(files["README.md"], b"# mine\n")
        self.assertEqual(files["roadmaps/go.json"], b"{}\n")
        self.assertTrue(all(p.startswith("roadkit/") for p in files if p not in ("README.md", "roadmaps/go.json")))
        (a.data / "y.json").unlink()
        self.engine(a, "a").run()
        self.assertNotIn("roadkit/state/y.json", self.gh.files())
        self.assertIn("README.md", self.gh.files())

    def test_branch_moving_during_write_is_retried(self):
        self.gh.commit_files({"README.md": b"x"})
        a = self.store()
        put(a, "w.json", STATE(1))
        self.engine(a, "a").run()
        put(a, "x.json", STATE(1))
        def other_device():
            self.gh.commit_files({**self.gh.files(), "roadkit/state/z.json": canonical_json(STATE(9))}, "other")
        self.gh.before_patch = other_device
        self.engine(a, "a").run()
        self.assertEqual(get(a, "z.json"), STATE(9))
        self.assertEqual(json.loads(self.gh.files()["roadkit/state/x.json"]), STATE(1))

    def test_unchanged_branch_costs_one_conditional_request(self):
        self.gh.commit_files({"roadkit/state/x.json": canonical_json(STATE(1))})
        p = self.provider()
        p.read()
        n = len(self.gh.requests)
        p.read()
        self.assertEqual(len(self.gh.requests), n + 1)
        self.assertIn("If-None-Match", self.gh.requests[-1][2])

    def test_links_submodules_and_odd_paths_are_ignored(self):
        self.gh.commit_files({"roadkit/state/link.json": b"/etc/passwd", "roadkit/state/sub.json": b"x",
                              "roadkit/../state/x.json": b"{}", "roadkitx/state/y.json": b"{}",
                              "roadkit/state/ok.json": canonical_json(STATE(1))},
                             modes={"roadkit/state/link.json": "120000", "roadkit/state/sub.json": "160000"})
        remote = self.provider().read()
        self.assertEqual(set(remote.files), {"../state/x.json", "state/ok.json"})
        a = self.store()
        self.engine(a, "a").run()
        self.assertEqual(sorted(p.name for p in a.data.rglob("*.json") if "_sync" not in p.parts), ["ok.json"])

    def test_redirects_are_refused(self):
        client = SafeClient(self.gh.token, self.gh.base, ssl_context=self.gh.client_context())
        with self.assertRaises(SyncError) as e:
            client.request("GET", "/redirect")
        self.assertIn("redirect", str(e.exception))
        self.assertFalse(any(path == "/steal" for _, path, _ in self.gh.requests))

    def test_oversized_answers_are_refused(self):
        client = SafeClient(self.gh.token, self.gh.base, ssl_context=self.gh.client_context(), max_bytes=1000)
        with self.assertRaises(TooLarge):
            client.request("GET", "/big")

    def test_untrusted_certificate_is_refused(self):
        client = SafeClient(self.gh.token, self.gh.base, ssl_context=ssl.create_default_context())
        with self.assertRaises(SyncError) as e:
            client.request("GET", f"/repos/{self.gh.owner}/{self.gh.repo}")
        self.assertIn("secure connection", str(e.exception))

    def test_token_never_in_errors(self):
        token = self.gh.token
        client = SafeClient(token, "https://127.0.0.1:1", ssl_context=self.gh.client_context(), timeout=2)
        for call in (lambda: client.request("GET", "/x"),
                     lambda: GitHubProvider(token, "me", "nope", "main", "roadkit",
                                            client=SafeClient(token, self.gh.base, ssl_context=self.gh.client_context())).check()):
            try:
                call()
            except Exception as e:                        # noqa: BLE001
                self.assertNotIn(token, str(e))
                self.assertNotIn(token, repr(e))


if __name__ == "__main__":
    unittest.main()
