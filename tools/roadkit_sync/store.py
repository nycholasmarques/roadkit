"""The local side: the data/ folder as a set of synced files, and the sync's own state in data/_sync/.

Everything that writes into data/ goes through the server's own lock and atomic write (injected), and a file is
only replaced when it is still the one the sync read: if you marked a topic during the sync, it raises Stale and the
engine merges again with your change.
"""
import json
import os
from pathlib import Path

from .errors import Stale
from .layout import blob_sha, canonical_json, kind_of, local_rel, remote_path

SYNC_DIR_NAME = "_sync"


class DataDirStore:
    def __init__(self, data_dir, lock, write_json, validators=None):
        """validators: {kind: fn(obj, path) -> None if valid, or a short reason}. Used for what comes from outside."""
        self.data = Path(data_dir)
        self.lock = lock
        self.write_json = write_json
        self.validators = validators or {}
        self.dir = self.data / SYNC_DIR_NAME

    # -- the synced files --
    def _files(self):
        if not self.data.is_dir():
            return
        for f in self.data.rglob("*.json"):
            rel = f.relative_to(self.data).as_posix()
            if rel.startswith(SYNC_DIR_NAME + "/") or "/." in "/" + rel or not f.is_file() or f.is_symlink():
                continue
            path = remote_path(rel)
            if path:
                yield path, f

    def _read(self, f):
        """Canonical bytes of a local file, or None when it is missing or not JSON (such a file is not synced)."""
        try:
            return canonical_json(json.loads(f.read_text("utf-8")))
        except (OSError, ValueError):
            return None

    def snapshot(self):
        """{path: canonical bytes} of every synced file in data/."""
        with self.lock:
            out = {}
            for path, f in self._files():
                data = self._read(f)
                if data is not None:
                    out[path] = data
            return out

    def validate(self, path, data):
        """None when bytes from outside may be written to `path`, or the reason they may not."""
        kind = kind_of(path)
        if not kind:
            return "not part of the layout"
        try:
            obj = json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            return "not valid JSON"
        check = self.validators.get(kind)
        return check(obj, path) if check else None

    def apply(self, changes, expected):
        """Writes {path: bytes | None} into data/. `expected` has the hash each file had when the sync read it
        (None: it did not exist); if any of them changed since, nothing is written and Stale is raised."""
        with self.lock:
            for path in changes:
                f = self.data / local_rel(path)
                now = self._read(f) if f.is_file() else None
                if (blob_sha(now) if now is not None else None) != expected.get(path):
                    raise Stale(f"{path} changed during the sync")
            for path, data in changes.items():
                f = self.data / local_rel(path)
                if data is None:
                    try:
                        f.unlink()
                    except FileNotFoundError:
                        pass
                else:
                    self.write_json(f, json.loads(data.decode("utf-8")))

    # -- the sync's own files --
    def load(self, name, default=None):
        try:
            return json.loads((self.dir / name).read_text("utf-8"))
        except (OSError, ValueError):
            return default

    def save(self, name, obj):
        self.write_json(self.dir / name, obj)

    def remove(self, name):
        try:
            (self.dir / name).unlink()
        except FileNotFoundError:
            pass

    def save_conflict(self, path, data, stamp):
        """Keeps the remote copy of a roadmap that changed on both sides, next to the sync's files."""
        name = f"{stamp}-{path.replace('/', '__')}"
        (self.dir / "conflicts").mkdir(parents=True, exist_ok=True)
        self.write_json(self.dir / "conflicts" / name, json.loads(data.decode("utf-8")))
        return name


def secret_mode_ok(path):
    """The token file must be readable only by the server's user."""
    try:
        return (os.stat(path).st_mode & 0o077) == 0
    except OSError:
        return False
