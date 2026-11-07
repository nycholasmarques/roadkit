"""The folder layout shared by every copy of the data, and how its files are written and hashed.

A synced folder mirrors data/, with names anyone opening the repository can read:

    roadkit-sync.json                 format of the folder and the devices that synced it
    state/<id>.json                   progress             (data/<id>.json)
    notes/<id>.json                   notes                (data/notes/<id>.json)
    activity/<id>.json                activity             (data/activity/<id>.json)
    review.json                       spaced review        (data/review.json)
    hidden.json                       hidden roadmaps      (data/_hidden.json)
    roadmaps/[<cat>/...]<id>.json     roadmaps made in the interface (data/roadmaps/...)
    roadmaps/<cat>/.../_section.json  the title of a category

Anything else in the folder is ignored, in both directions.
"""
import hashlib
import json
import re

FORMAT = 1
MANIFEST = "roadkit-sync.json"

_ID = r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}"          # STATE_ID in roadkit.py
_SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"                # roadmap ids made in the interface
_CAT = r"[a-z0-9][a-z0-9_-]{0,39}"                 # CATEGORY_PART in roadkit.py

KINDS = (
    ("state", re.compile(rf"state/{_ID}\.json")),
    ("notes", re.compile(rf"notes/{_ID}\.json")),
    ("activity", re.compile(rf"activity/{_ID}\.json")),
    ("review", re.compile(r"review\.json")),
    ("hidden", re.compile(r"hidden\.json")),
    ("section", re.compile(rf"roadmaps/(?:{_CAT}/){{1,3}}_section\.json")),
    ("roadmap", re.compile(rf"roadmaps/(?:{_CAT}/){{0,3}}{_SLUG}\.json")),
)


def kind_of(path):
    """The kind of a path in the synced folder, or None when it is not part of the layout."""
    if not isinstance(path, str) or len(path) > 400 or path.startswith("/") or "\\" in path:
        return None
    if any(seg in ("", ".", "..") for seg in path.split("/")):
        return None
    for kind, rx in KINDS:
        if rx.fullmatch(path):
            return kind
    return None


def canonical_json(obj):
    """The bytes every device writes for the same data: indented, sorted keys, UTF-8, newline at the end.
    The same data always gives the same bytes, so the same hash on every machine."""
    return (json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def blob_sha(data):
    """The hash Git gives a file with these bytes (`git hash-object`): comparing it with a tree entry says
    whether a file changed without downloading it."""
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


# where each path lives inside data/ (relative), and back
def local_rel(path):
    kind = kind_of(path)
    if kind == "state":
        return path[len("state/"):]
    if kind == "hidden":
        return "_hidden.json"
    if kind in ("notes", "activity", "review", "roadmap", "section"):
        return path
    return None


def remote_path(rel):
    """The synced path of a file of data/ (relative, with '/'), or None when it is not synced."""
    parts = rel.split("/")
    if len(parts) == 1:
        if rel == "_hidden.json":
            return "hidden.json"
        if rel == "review.json":
            return rel
        candidate = "state/" + rel
    else:
        candidate = rel
    return candidate if kind_of(candidate) else None
