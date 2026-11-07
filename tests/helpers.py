"""Shared test helpers: imports from tools/, a throwaway data folder, and an in-memory destination."""
import json
import sys
import tempfile
import threading
from pathlib import Path

TOOLS = Path(__file__).resolve().parent.parent / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from roadkit_sync.errors import Conflict  # noqa: E402
from roadkit_sync.layout import blob_sha  # noqa: E402
from roadkit_sync.provider import Provider, Remote  # noqa: E402
from roadkit_sync.store import DataDirStore  # noqa: E402


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", "utf-8")


def make_store(validators=None):
    tmp = tempfile.TemporaryDirectory()
    store = DataDirStore(Path(tmp.name), threading.Lock(), write_json, validators or {})
    store._tmp = tmp                      # keep the folder alive as long as the store
    return store


def put(store, rel, obj):
    write_json(store.data / rel, obj)


def get(store, rel):
    try:
        return json.loads((store.data / rel).read_text("utf-8"))
    except FileNotFoundError:
        return None


class MemoryProvider(Provider):
    """A destination in memory, with revisions like a Git branch. Shared by several engines, it plays the
    repository that two machines sync with."""
    name = "memory"

    def __init__(self):
        self.files, self.rev, self.commits = {}, None, []
        self.before_write = None          # a hook to simulate another device writing in between

    def read(self):
        return Remote(self.rev, {p: blob_sha(b) for p, b in self.files.items()})

    def fetch(self, path, sha):
        return self.files[path]

    def write(self, rev, changes, message):
        if self.before_write:
            hook, self.before_write = self.before_write, None
            hook()
        if rev != self.rev:
            raise Conflict("moved")
        for p, data in changes.items():
            if data is None:
                self.files.pop(p, None)
            else:
                self.files[p] = data
        self.commits.append((message, sorted(changes)))
        self.rev = f"r{len(self.commits)}"
        return self.rev
