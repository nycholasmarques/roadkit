"""The sync as the server runs it: settings, the secret, pairing, and one background thread.

Files in data/_sync/ (never synced, never served):
    config.json   destination, mode, device, confirmation of a public repository
    secret.json   the token (mode 0600); ROADKIT_SYNC_TOKEN or ROADKIT_SYNC_TOKEN_FILE take precedence
    status.json   last sync, last error, next try
    base.json     what both sides agreed on after the last sync (engine)
"""
import os
import re
import secrets
import threading
import time

from .engine import SyncEngine
from .errors import NeedsChoice, PublicRepo, RateLimited, SyncError
from .github import valid_branch, valid_folder, valid_owner_repo
from .pairing import Pairing
from .provider import PROVIDERS

MODES = ("off", "manual", "auto")
PUSH_DELAY = 120          # automatic: send 2 minutes after the last change
PULL_EVERY = 900          # automatic: fetch every 15 minutes
BACKOFF = (60, 3600)      # wait after an error, doubling, between these
LABEL = re.compile(r"^[\w .@-]{0,40}$")


class ServiceError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _now_ms(clock):
    return int(clock() * 1000)


class SyncService:
    def __init__(self, store, compact=None, user_agent="roadkit", env=None, out=print, clock=time.time,
                 provider_factory=None):
        self.store, self.compact, self.user_agent = store, compact, user_agent
        self.env = os.environ if env is None else env
        self.clock = clock
        self.pairing = Pairing(out=out)
        self._factory = provider_factory or self._make_provider
        self._run_lock = threading.Lock()         # one sync at a time
        self._lock = threading.Lock()             # settings and status
        self._wake = threading.Event()
        self._provider, self._provider_key = None, None
        self._push_due = None
        self._next_pull = None
        self._failures = 0
        self._thread = None

    # -- settings and secret --
    def config(self):
        c = self.store.load("config.json", {})
        return c if isinstance(c, dict) else {}

    def _save_config(self, c):
        self.store.save("config.json", c)

    def token(self):
        """(token, source): the environment wins over the one saved from the settings."""
        env = self.env.get("ROADKIT_SYNC_TOKEN", "").strip()
        if env:
            return env, "env"
        path = self.env.get("ROADKIT_SYNC_TOKEN_FILE", "").strip()
        if path:
            try:
                with open(path, encoding="utf-8") as fh:
                    value = fh.read().strip()
                if value:
                    return value, "env"
            except OSError:
                pass
        s = self.store.load("secret.json", {})
        t = s.get("token") if isinstance(s, dict) else None
        return (t, "ui") if isinstance(t, str) and t else (None, None)

    def status(self):
        s = self.store.load("status.json", {})
        return s if isinstance(s, dict) else {}

    def _set_status(self, **kw):
        with self._lock:
            s = self.status()
            s.update(kw)
            self.store.save("status.json", s)
            return s

    def info(self):
        """Everything the settings screen shows. Never the token, nor any part of it."""
        c, (tok, source) = self.config(), self.token()
        dest = {k: c.get(k) for k in ("provider", "owner", "repo", "branch", "folder")}
        return {"configured": bool(c.get("provider") and tok), "mode": c.get("mode", "off"), **dest,
                "device": c.get("device"), "label": c.get("label", ""), "tokenSet": bool(tok), "tokenSource": source,
                "tokenKind": c.get("tokenKind"), "tokenExpires": c.get("tokenExpires"), "private": c.get("private"),
                "publicAck": bool(c.get("publicAck")) and c.get("publicAck") == c.get("repoId"),
                "status": self.status(), "providers": sorted(PROVIDERS)}

    # -- authorization for changes that decide where the data goes --
    def authorized(self, api_token_on, ticket):
        return api_token_on or self.pairing.allowed(ticket)

    def _require(self, api_token_on, ticket):
        if not self.authorized(api_token_on, ticket):
            raise ServiceError(403, "pairing required: ask for a code and type the one in the server log")

    def pair(self):
        if not self.pairing.new_code():
            raise ServiceError(429, "a code was just created; look in the server log or wait 30 seconds")
        return {"ok": True}

    def unlock(self, code):
        got = self.pairing.unlock(code)
        if not got:
            raise ServiceError(403, "wrong or expired code")
        return {"ticket": got[0], "expiresIn": got[1]}

    # -- destination --
    def _destination(self, body):
        if not isinstance(body, dict):
            raise ServiceError(400, "send a JSON object")
        provider = body.get("provider", "github")
        if provider not in PROVIDERS:
            raise ServiceError(400, "unknown provider")
        dest = {"provider": provider, "owner": str(body.get("owner", "")).strip(), "repo": str(body.get("repo", "")).strip(),
                "branch": str(body.get("branch") or "main").strip(), "folder": str(body.get("folder") or "roadkit").strip().strip("/")}
        if not valid_owner_repo(dest["owner"], dest["repo"]):
            raise ServiceError(400, "owner and repository: letters, numbers, '.', '-' and '_'")
        if not valid_branch(dest["branch"]):
            raise ServiceError(400, "invalid branch name")
        if not valid_folder(dest["folder"]):
            raise ServiceError(400, "the folder must be a folder inside the repository, like 'roadkit'")
        return dest

    def _token_for(self, body):
        new = body.get("token") if isinstance(body, dict) else None
        tok, source = self.token()
        if new:
            if source == "env":
                raise ServiceError(409, "the token is set by the environment (ROADKIT_SYNC_TOKEN); change it there")
            if not isinstance(new, str) or len(new) > 255 or any(ch.isspace() for ch in new):
                raise ServiceError(400, "that does not look like a GitHub token")
            return new
        if not tok:
            raise ServiceError(400, "paste a token")
        return tok

    def _make_provider(self, dest, token):
        return PROVIDERS[dest["provider"]](token, dest["owner"], dest["repo"], dest["branch"], dest["folder"],
                                           user_agent=self.user_agent)

    def _check(self, dest, token):
        try:
            return self._factory(dest, token).check()
        except ValueError as e:
            raise ServiceError(400, str(e))
        except SyncError as e:
            raise ServiceError(400, str(e) or e.code)

    def test(self, body, api_token_on):
        self._require(api_token_on, body.get("ticket") if isinstance(body, dict) else None)
        dest = self._destination(body)
        return self._check(dest, self._token_for(body))

    def setup(self, body, api_token_on):
        """Saves a destination (and a token) after checking it really works. A public repository needs publicAck."""
        self._require(api_token_on, body.get("ticket") if isinstance(body, dict) else None)
        dest = self._destination(body)
        token = self._token_for(body)
        info = self._check(dest, token)
        if not info.get("private") and body.get("publicAck") is not True:
            raise ServiceError(409, "public repository: confirm that your notes and progress will be public")
        c = self.config()
        same_place = all(c.get(k) == dest[k] for k in dest) and c.get("repoId") == info.get("repoId")
        mode = body.get("mode") if body.get("mode") in MODES else (c.get("mode") if c.get("mode") in ("manual", "auto") else "manual")
        label = body.get("label", c.get("label", ""))
        if not isinstance(label, str) or not LABEL.match(label):
            raise ServiceError(400, "device name: up to 40 letters, numbers, spaces, '.', '-' or '_'")
        c = {**dest, "mode": mode, "label": label, "device": c.get("device") or secrets.token_hex(3),
             "repoId": info.get("repoId"), "private": bool(info.get("private")), "tokenKind": info.get("tokenKind"),
             "tokenExpires": info.get("tokenExpires"),
             "publicAck": info.get("repoId") if not info.get("private") else None}
        with self._lock:
            if body.get("token"):
                self.store.save("secret.json", {"token": token})
            self._save_config(c)
            if not same_place:
                self.store.remove("base.json")            # another destination: the next sync starts from scratch
                self.store.remove("status.json")
            self._provider = None
        self._failures, self._push_due, self._next_pull = 0, None, None
        self._set_status(state="idle", lastError=None, needsChoice=False)
        self._wake.set()
        return self.info()

    def set_mode(self, body):
        """Manual or automatic (or off) and the device name: they do not change where the data goes."""
        if not isinstance(body, dict):
            raise ServiceError(400, "send a JSON object")
        c = self.config()
        if "mode" in body:
            if body["mode"] not in MODES:
                raise ServiceError(400, "mode is off, manual or auto")
            if body["mode"] != "off" and not c.get("provider"):
                raise ServiceError(409, "set up the destination first")
            c["mode"] = body["mode"]
        if "label" in body:
            if not isinstance(body["label"], str) or not LABEL.match(body["label"]):
                raise ServiceError(400, "device name: up to 40 letters, numbers, spaces, '.', '-' or '_'")
            c["label"] = body["label"]
        self._save_config(c)
        if c.get("mode") == "auto" and self.status().get("state") == "paused" and not self.status().get("needsChoice"):
            self._set_status(state="idle")                # switching to automatic again is how you resume it
        self._failures = 0
        self._wake.set()
        return self.info()

    def disconnect(self):
        with self._lock:
            for name in ("config.json", "secret.json", "base.json", "status.json"):
                self.store.remove(name)
            self._provider = None
        self.pairing.forget()
        self._wake.set()
        return self.info()

    # -- running --
    def _engine(self):
        c, (token, _) = self.config(), self.token()
        if not c.get("provider") or not token:
            raise ServiceError(409, "sync is not set up")
        key = (c["provider"], c["owner"], c["repo"], c["branch"], c["folder"], token)
        if self._provider is None or self._provider_key != key:
            self._provider, self._provider_key = self._factory(c, token), key
        label = c.get("label") or c.get("device") or "roadkit"
        return SyncEngine(self.store, self._provider, device=label, compact=self.compact, clock=self.clock), c

    def run(self, mode="sync", first=None):
        """One sync now (the button, or the background thread). Returns info(); errors end up in the status."""
        with self._run_lock:
            engine, c = self._engine()
            if c.get("mode") not in ("manual", "auto"):
                raise ServiceError(409, "sync is off")
            self._set_status(state="syncing")
            try:
                info = self._provider.check()
                if not info.get("private") and c.get("publicAck") != info.get("repoId"):
                    raise PublicRepo("the repository is public now: confirm it again in the settings")
                if info.get("tokenExpires") != c.get("tokenExpires"):
                    c["tokenExpires"] = info.get("tokenExpires")
                    self._save_config(c)
                result = engine.run(mode, first)
            except SyncError as e:
                self._failed(e)
                return self.info()
            self._failures = 0
            self._push_due = None
            self._next_pull = self.clock() + PULL_EVERY
            self._set_status(state="ok", lastSync=_now_ms(self.clock), lastError=None, needsChoice=False, nextTry=None,
                             pushed=len(result.pushed), pulled=len(result.pulled), changed=bool(result.pulled),
                             conflicts=result.conflicts, skipped=result.skipped)
            return self.info()

    def _failed(self, e):
        message = str(e) or e.code
        if isinstance(e, NeedsChoice):
            self._set_status(state="paused", needsChoice=True, lastError={"code": e.code, "message": message}, nextTry=None)
            return
        if e.pause:
            self._set_status(state="paused", lastError={"code": e.code, "message": message}, nextTry=None)
            return
        self._failures += 1
        self._push_due = None                             # the retry below is a full sync: it sends what is pending
        wait = min(BACKOFF[1], BACKOFF[0] * 2 ** (self._failures - 1))
        if isinstance(e, RateLimited) and e.retry_at:
            wait = max(wait, e.retry_at - self.clock())
        self._next_pull = self.clock() + wait
        self._set_status(state="error", lastError={"code": e.code, "message": message},
                         nextTry=_now_ms(self.clock) + int(wait * 1000))

    def notify_change(self):
        """Called by the server after it saved something: in automatic mode, send it a little later."""
        if self.config().get("mode") != "auto":
            return
        due = self.clock() + PUSH_DELAY
        if self._push_due is None or due < self._push_due:
            self._push_due = due
        self._wake.set()

    # -- the background thread (automatic mode) --
    def start(self):
        if self._thread is None:
            self._next_pull = self.clock()                # fetch once when the server starts
            self._thread = threading.Thread(target=self._loop, name="roadkit-sync", daemon=True)
            self._thread.start()

    def _due(self):
        c = self.config()
        if c.get("mode") != "auto" or self.status().get("state") == "paused":
            return None
        times = [t for t in (self._push_due, self._next_pull) if t is not None]
        return min(times) if times else None

    def tick(self):
        """One look at the clock: runs a sync if one is due. Returns seconds until the next look."""
        due = self._due()
        if due is None:
            return 300
        wait = due - self.clock()
        if wait > 0:
            return min(wait, 300)
        try:
            self.run("sync")
        except ServiceError:
            return 300
        return 1

    def _loop(self):
        while True:
            wait = self.tick()
            self._wake.wait(timeout=max(1, wait))
            self._wake.clear()
