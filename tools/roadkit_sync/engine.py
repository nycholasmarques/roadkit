"""One sync, start to end: read both sides, merge each file in three ways, check what came from outside, write the
remote in one go, apply the local, and remember the result as the base for next time.

The base (data/_sync/base.json) is what both sides agreed on after the last sync: the hash of each file, and the
content of the files whose merge needs it (activity and the hidden list). With it, "only one side changed" is clear
for every file, which is also how a deletion reaches the other devices.
"""
import json
import time
from dataclasses import dataclass, field
from datetime import datetime

from . import merge as merging
from .errors import Busy, Conflict, NeedsChoice, RemoteFormat, Stale, TooLarge
from .layout import FORMAT, MANIFEST, blob_sha, canonical_json, kind_of

MAX_FILES = 2000
MAX_TOTAL_BYTES = 20 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024
ROUNDS = 3
BASE_CONTENT_KINDS = ("activity", "hidden")
MODES = ("sync", "push", "pull")
FIRST = (None, "merge", "remote", "local")


@dataclass
class Result:
    rev: str | None = None
    pushed: list = field(default_factory=list)
    pulled: list = field(default_factory=list)
    conflicts: list = field(default_factory=list)
    skipped: list = field(default_factory=list)


def _summary(paths, device):
    count = {}
    for p in paths:
        k = kind_of(p) or "file"
        count[k] = count.get(k, 0) + 1
    names = {"state": "progress", "notes": "notes", "activity": "activity", "review": "review",
             "hidden": "hidden list", "roadmap": "roadmap", "section": "category"}
    parts = [f"{names.get(k, k)} ×{n}" if n > 1 else names.get(k, k) for k, n in sorted(count.items())]
    return f"roadkit: {', '.join(parts) or 'sync'} ({device})"


class SyncEngine:
    def __init__(self, store, provider, device="roadkit", compact=None, clock=time.time):
        self.store, self.provider, self.device = store, provider, device
        self.compact, self.clock = compact, clock

    def run(self, mode="sync", first=None):
        if mode not in MODES or first not in FIRST:
            raise ValueError("unknown mode")
        for _ in range(ROUNDS):
            try:
                return self._once(mode, first)
            except (Conflict, Stale):
                continue
        raise Busy("the data kept changing during the sync; it will try again")

    # -- one round --
    def _fetch(self, path, sha, budget):
        data = self.provider.fetch(path, sha)
        if len(data) > MAX_FILE_BYTES:
            raise TooLarge(f"{path} is larger than {MAX_FILE_BYTES // 1024 // 1024} MB")
        budget[0] += len(data)
        if budget[0] > MAX_TOTAL_BYTES:
            raise TooLarge("the synced folder is larger than 20 MB")
        if blob_sha(data) != sha:
            raise Conflict(f"{path} changed while it was being read")
        return data

    def _once(self, mode, first):
        remote = self.provider.read()
        if len(remote.files) > MAX_FILES:
            raise TooLarge(f"the synced folder has more than {MAX_FILES} files")
        budget = [0]
        manifest = {}
        if MANIFEST in remote.files:
            try:
                manifest = json.loads(self._fetch(MANIFEST, remote.files[MANIFEST], budget))
            except ValueError:
                manifest = {}
            fmt = manifest.get("format") if isinstance(manifest, dict) else None
            if isinstance(fmt, int) and fmt > FORMAT:
                raise RemoteFormat(f"the folder uses format {fmt}; update Roadkit to sync it")
            if not isinstance(manifest, dict):
                manifest = {}
        rfiles = {p: s for p, s in remote.files.items() if kind_of(p)}
        local = self.store.snapshot()
        lsha = {p: blob_sha(b) for p, b in local.items()}

        base = self.store.load("base.json")
        if not isinstance(base, dict) or not isinstance(base.get("files"), dict):
            base = None
        if base is None:
            if rfiles and local and first is None:
                raise NeedsChoice("both sides have data")
            if first == "remote":
                base = {"files": dict(lsha), "content": {}}       # this device "did not change": the remote wins
            elif first == "local":
                base = {"files": dict(rfiles), "content": {}}     # the remote "did not change": this device wins
            else:
                base = {"files": {}, "content": {}, "first": True}
        bfiles, bcontent = base["files"], base.get("content") or {}
        first_merge = bool(base.get("first"))

        to_local, to_remote, result = {}, {}, Result()
        today = datetime.fromtimestamp(self.clock()).strftime("%Y-%m-%d")
        stamp = datetime.fromtimestamp(self.clock()).strftime("%Y%m%d-%H%M%S")
        fetched = {}

        def remote_bytes(p):
            if p not in fetched:
                fetched[p] = self._fetch(p, rfiles[p], budget)
            return fetched[p]

        for p in sorted(set(lsha) | set(rfiles) | set(bfiles)):
            if not kind_of(p):
                continue
            b, l, r = bfiles.get(p), lsha.get(p), rfiles.get(p)
            if l == r:
                continue
            if l == b:                                    # only the remote changed (or was deleted there)
                to_local[p] = None if r is None else remote_bytes(p)
            elif r == b:                                  # only this device changed
                to_remote[p] = local.get(p)
            elif l is None or r is None:                  # deleted on one side, changed on the other: keep it
                if l is None:
                    to_local[p] = remote_bytes(p)
                else:
                    to_remote[p] = local[p]
            else:                                         # both changed
                rb = remote_bytes(p)
                why = self.store.validate(p, rb)
                if why:
                    result.skipped.append({"path": p, "reason": why})
                    to_remote[p] = local[p]               # the remote copy is broken: this device's copy repairs it
                    continue
                kind = kind_of(p)
                lo, ro = json.loads(local[p]), json.loads(rb)
                bo = None if first_merge else bcontent.get(p)
                merged, conflict = merging.merge(kind, bo, lo, ro, self.compact, today)
                if conflict:
                    result.conflicts.append(self.store.save_conflict(p, rb, stamp))
                mb = canonical_json(merged)
                if blob_sha(mb) != l:
                    to_local[p] = mb
                if blob_sha(mb) != r:
                    to_remote[p] = mb

        # what comes from outside is checked like a request from the browser before it touches data/
        for p in list(to_local):
            data = to_local[p]
            if data is None or data is local.get(p) or (p in to_remote and to_remote[p] is data):
                continue
            why = self.store.validate(p, data)
            if why:
                result.skipped.append({"path": p, "reason": why})
                del to_local[p]

        if mode == "push":
            to_local = {}
        elif mode == "pull":
            to_remote = {}

        rev = remote.rev
        if to_remote:
            devices = manifest.get("devices") if isinstance(manifest.get("devices"), dict) else {}
            devices = {k: v for k, v in devices.items() if isinstance(k, str) and isinstance(v, dict)}
            devices[self.device] = {"at": int(self.clock() * 1000)}
            changes = dict(to_remote)
            changes[MANIFEST] = canonical_json({"format": FORMAT, "devices": devices})
            rev = self.provider.write(remote.rev, changes, _summary(to_remote, self.device))
        if to_local:
            self.store.apply(to_local, {p: lsha.get(p) for p in to_local})

        # the new base: every file both sides now hold with the same bytes
        final_local = {p: b for p, b in local.items()}
        for p, data in to_local.items():
            if data is None:
                final_local.pop(p, None)
            else:
                final_local[p] = data
        final_remote = dict(rfiles)
        for p, data in to_remote.items():
            if data is None:
                final_remote.pop(p, None)
            else:
                final_remote[p] = blob_sha(data)
        files, content = {}, {}
        for p, data in final_local.items():
            sha = blob_sha(data)
            if final_remote.get(p) == sha:
                files[p] = sha
                if kind_of(p) in BASE_CONTENT_KINDS:
                    content[p] = json.loads(data)
            elif p in bfiles and mode != "sync":
                files[p] = bfiles[p]                      # one-way sync: this file still differs, keep its old base
                if p in bcontent:
                    content[p] = bcontent[p]
        if mode != "sync":
            for p in bfiles:
                if p not in files and (p in final_local) != (p in final_remote):
                    files[p] = bfiles[p]
                    if p in bcontent:
                        content[p] = bcontent[p]
        self.store.save("base.json", {"rev": rev, "files": files, "content": content})

        result.rev = rev
        result.pushed = sorted(to_remote)
        result.pulled = sorted(to_local)
        return result
