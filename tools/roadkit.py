#!/usr/bin/env python3
"""Roadkit CLI (stdlib only).

  python3 tools/roadkit.py serve [--port 8765] [--host 127.0.0.1]   serve the UI (manifest.json is rebuilt on every load)
  python3 tools/roadkit.py check [file.json ...]                    validate roadmaps and rebuild manifest.json
  python3 tools/roadkit.py index                                    rebuild manifest.json only

Progress is saved on the server in data/<roadmap-id>.json (ROADKIT_DATA changes the folder).
Set ROADKIT_TOKEN to require a bearer token for the progress API.
"""
import argparse
import functools
import hashlib
import http.server
import hmac
import json
import os
import posixpath
import re
import sys
import tempfile
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
ROADMAPS = ROOT / "roadmaps"
ROOT_TITLE = "Meus roadmaps"  # section for files placed directly in roadmaps/
EXAMPLE_GROUPS = [("examples/pt-BR", "Exemplos em português"), ("examples/en", "Examples in English")]
MANIFEST = ROOT / "manifest.json"
LABELS_DIR = ROOT / "src" / "labels"
DATA_DIR = Path(os.environ.get("ROADKIT_DATA") or ROOT / "data")  # saved progress, one JSON per roadmap
TOKEN = os.environ.get("ROADKIT_TOKEN", "")                       # optional: require it for the progress API
USER_DIR = DATA_DIR / "roadmaps"                                  # roadmaps created in the UI
HIDDEN_FILE = DATA_DIR / "_hidden.json"                           # ids hidden from the picker (read-only roadmaps can't be deleted)
LOCK = threading.Lock()
STATE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
MAX_STATE_BYTES = 1_000_000
NOTES_DIR = DATA_DIR / "notes"                                    # personal notes, one JSON per roadmap
NOTE_KEY = re.compile(r"^(roadmap|node:[A-Za-z0-9._-]{1,100}|project:[A-Za-z0-9._-]{1,100})$")
MAX_NOTE_CHARS = 20_000
ACTIVITY_DIR = DATA_DIR / "activity"                              # what you did and when, one small JSON per roadmap
ACTIVITY_DAYS = 730                                               # daily totals kept; older days become monthly totals

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
TOP_KEYS = {"$schema", "schemaVersion", "id", "meta", "theme", "labels", "phases", "nodes", "projects"}
META_KEYS = {"title", "eyebrow", "subtitle", "description", "icon", "language", "brand", "tagline", "sidebarNote", "footer", "defaultView", "startDate"}
THEME_KEYS = {"accent", "brandAccent"}
PHASE_KEYS = {"id", "title", "summary", "period", "color", "milestone", "due"}
NODE_KEYS = {"id", "title", "phase", "time", "summary", "topics", "challenge", "success", "links", "optional", "anchor", "parent", "status", "tasks", "due"}
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_day(v):
    """A calendar day written as YYYY-MM-DD."""
    if not isinstance(v, str) or not DAY.match(v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False
MAX_DEPTH = 2  # sub-topics go at most this many levels below a main topic
STATUSES = ("todo", "working", "review", "finished")
TASK_KEYS = {"id", "title", "note", "status"}
PROJECT_KEYS = {"id", "title", "level", "summary", "uses", "requirements", "deliverable", "success", "stretch", "time", "links"}
LEVELS = ("beginner", "intermediate", "advanced")
REQ_KEYS = {"id", "title"}
MAX_REPO_URL = 300


def pretty(name):
    return name.replace("-", " ").replace("_", " ").strip().capitalize()


def section_title(folder):
    """Title of a roadmaps/ subfolder: `title` from its _section.json, or the folder name made readable."""
    meta = folder / "_section.json"
    if meta.exists():
        try:
            title = json.loads(meta.read_text("utf-8")).get("title")
            if isinstance(title, str) and title.strip():
                return title.strip()
            print(f"warn: {rel(meta)} needs a non-empty 'title'", file=sys.stderr)
        except (OSError, ValueError, AttributeError) as e:
            print(f"warn: {rel(meta)} is not valid ({e})", file=sys.stderr)
    return pretty(folder.name)


def json_files(folder):
    return sorted(p for p in folder.glob("*.json") if not p.name.startswith(("_", ".")))


def category_dirs():
    """Section path (posix, '' for the top level) -> the folders that hold it. roadmaps/ and the data folder
    (where the UI saves) share the same sections, so a roadmap made in the UI lands next to your files."""
    out = {}
    for base in (ROADMAPS, USER_DIR):
        if not base.is_dir():
            continue
        for d in [base] + sorted(base.rglob("*")):
            if not d.is_dir():
                continue
            parts = d.relative_to(base).parts
            if not any(part.startswith((".", "_")) for part in parts):
                out.setdefault("/".join(parts), []).append(d)
    return out


def prefix_title(parts):
    folders = [b.joinpath(*parts) for b in (ROADMAPS, USER_DIR) if b.joinpath(*parts).is_dir()]
    for f in folders:
        if (f / "_section.json").is_file():
            return section_title(f)
    return section_title(folders[0]) if folders else pretty(parts[-1])


def discover():
    """Sections in display order: (group id, title, files). Every folder below roadmaps/ (or below the data
    folder's roadmaps/) is a section, at any depth; folders starting with '.' or '_' are ignored. Examples come last."""
    out, dirs = [], category_dirs()
    for path in sorted(dirs, key=lambda r: (r != "", r.lower())):
        files = [f for d in dirs[path] for f in json_files(d)]
        if not files:
            continue
        if not path:
            out.append(("roadmaps", ROOT_TITLE, files))
        else:
            parts = path.split("/")
            out.append(("roadmaps/" + path, " / ".join(prefix_title(parts[: i + 1]) for i in range(len(parts))), files))
    for gid, title in EXAMPLE_GROUPS:
        files = json_files(ROOT / gid) if (ROOT / gid).is_dir() else []
        if files:
            out.append((gid, title, files))
    return out


def roadmap_files():
    for gid, _, files in discover():
        for p in files:
            yield gid, p


def label_keys():
    return set(json.loads((LABELS_DIR / "pt-BR.json").read_text("utf-8")))


def validate(data, known_labels):
    """Return (errors, warnings) for one parsed roadmap."""
    errs, warns = [], []
    if not isinstance(data, dict):
        return ["top level must be a JSON object"], warns
    for k in data:
        if k not in TOP_KEYS:
            warns.append(f"unknown top-level key '{k}'")
    if data.get("schemaVersion", 1) != 1:
        errs.append("schemaVersion must be 1")
    rid = data.get("id")
    if not isinstance(rid, str) or not SLUG.match(rid):
        errs.append("'id' is required: lowercase slug like 'meu-roadmap'")

    meta = data.get("meta")
    if not isinstance(meta, dict) or not meta.get("title"):
        errs.append("'meta.title' is required")
        meta = meta if isinstance(meta, dict) else {}
    for k in meta:
        if k not in META_KEYS:
            warns.append(f"unknown meta key '{k}'")
    if "language" in meta and not (LABELS_DIR / f"{meta['language']}.json").exists():
        warns.append(f"meta.language '{meta['language']}' has no src/labels/ pack; falling back to pt-BR")
    if "defaultView" in meta and meta["defaultView"] not in ("map", "kanban"):
        errs.append("meta.defaultView must be map or kanban")
    if "startDate" in meta and not valid_day(meta["startDate"]):
        errs.append("meta.startDate must be a date like 2026-01-31")
    theme = data.get("theme", {})
    for k, v in (theme.items() if isinstance(theme, dict) else []):
        if k not in THEME_KEYS:
            warns.append(f"unknown theme key '{k}'")
        elif not HEX.match(str(v)):
            errs.append(f"theme.{k} must be a hex color like '#233b65'")
    for k in (data.get("labels") or {}):
        if k not in known_labels:
            warns.append(f"unknown label '{k}' (see src/labels/pt-BR.json)")

    phases = data.get("phases") or []
    phase_ids, last_due = [], ""
    if not isinstance(phases, list):
        errs.append("'phases' must be a list")
        phases = []
    for i, p in enumerate(phases):
        w = f"phases[{i}]"
        if not isinstance(p, dict):
            errs.append(f"{w} must be an object")
            continue
        for k in p:
            if k not in PHASE_KEYS:
                warns.append(f"{w}: unknown key '{k}'")
        pid = p.get("id")
        if not isinstance(pid, str) or not SLUG.match(pid):
            errs.append(f"{w}: 'id' must be a lowercase slug")
        elif pid in phase_ids:
            errs.append(f"{w}: duplicate phase id '{pid}'")
        else:
            phase_ids.append(pid)
        if not p.get("title"):
            errs.append(f"{w}: 'title' is required")
        if "color" in p and not HEX.match(str(p["color"])):
            errs.append(f"{w}: 'color' must be hex like '#3a68d1'")
        if "due" in p:
            if not valid_day(p["due"]):
                errs.append(f"{w}: 'due' must be a date like 2026-01-31")
            else:
                if last_due and p["due"] < last_due:
                    warns.append(f"{w}: due {p['due']} is before the previous phase's ({last_due})")
                last_due = p["due"]

    nodes = data.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        errs.append("'nodes' must be a non-empty list")
        return errs, warns
    ids, core_ids, core_phase_idx = {}, [], []
    for i, n in enumerate(nodes):
        w = f"nodes[{i}]"
        if not isinstance(n, dict):
            errs.append(f"{w} must be an object")
            continue
        nid = n.get("id")
        w = f"nodes[{i}] ({nid})"
        if not isinstance(nid, str) or not SLUG.match(nid):
            errs.append(f"{w}: 'id' must be a lowercase slug")
            continue
        if nid in ids:
            errs.append(f"{w}: duplicate node id")
        ids[nid] = n
        for k in n:
            if k not in NODE_KEYS:
                warns.append(f"{w}: unknown key '{k}'")
        title = n.get("title")
        if not title:
            errs.append(f"{w}: 'title' is required")
        elif len(title) > 60:
            warns.append(f"{w}: title has {len(title)} chars; keep it short (<= 60)")
        hangs = bool(n.get("parent") or (n.get("optional") and n.get("anchor")))
        if phases:
            if n.get("phase") not in phase_ids and not (hangs and "phase" not in n):
                errs.append(f"{w}: 'phase' must be one of {phase_ids}" + (" (or omit it to inherit the parent's)" if hangs else ""))
        elif "phase" in n:
            warns.append(f"{w}: 'phase' ignored because the roadmap defines no phases")
        for key in ("topics",):
            v = n.get(key, [])
            if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                errs.append(f"{w}: '{key}' must be a list of strings")
        for key in ("time", "summary", "challenge", "success"):
            if key in n and not isinstance(n[key], str):
                errs.append(f"{w}: '{key}' must be a string")
        validate_links(n.get("links", []), w, errs)
        if "due" in n and not valid_day(n["due"]):
            errs.append(f"{w}: 'due' must be a date like 2026-01-31")
        if "status" in n and n["status"] not in STATUSES:
            errs.append(f"{w}: status must be one of {list(STATUSES)}")
        tasks = n.get("tasks", [])
        if not isinstance(tasks, list):
            errs.append(f"{w}: tasks must be a list")
        else:
            if len(tasks) > 10:
                warns.append(f"{w}: {len(tasks)} tasks; a card kanban reads best with 3 to 8")
            task_ids = set()
            for j, t in enumerate(tasks):
                tw = f"{w}: tasks[{j}]"
                if not isinstance(t, dict):
                    errs.append(f"{tw} must be an object")
                    continue
                for k in t:
                    if k not in TASK_KEYS:
                        warns.append(f"{tw}: unknown key {k}")
                if not t.get("title"):
                    errs.append(f"{tw}: title is required")
                if not isinstance(t.get("id"), str) or not SLUG.match(t["id"]):
                    errs.append(f"{tw}: id must be a lowercase slug")
                elif t["id"] in task_ids:
                    errs.append(f"{tw}: duplicate task id {t[id]}")
                else:
                    task_ids.add(t["id"])
                if "status" in t and t["status"] not in STATUSES:
                    errs.append(f"{tw}: status must be one of {list(STATUSES)}")
        if n.get("optional") and not hangs:
            errs.append(f"{w}: optional nodes need a 'parent' (the topic they hang from; 'anchor' also works)")
        if "anchor" in n and not n.get("optional"):
            warns.append(f"{w}: 'anchor' only applies to optional nodes; use 'parent' for sub-topics")
        if not n.get("optional") and not n.get("parent"):
            core_ids.append(nid)
            if phases and n.get("phase") in phase_ids:
                core_phase_idx.append(phase_ids.index(n["phase"]))
    depth_of = {}

    def depth(nid, trail=()):
        if nid in depth_of:
            return depth_of[nid]
        n = ids[nid]
        pid = n.get("parent") or (n.get("anchor") if n.get("optional") else None)
        if not pid:
            d = 0
        elif pid not in ids or pid == nid or pid in trail or nid in trail:
            d = None
        else:
            pd = depth(pid, trail + (nid,))
            d = None if pd is None else pd + 1
        depth_of[nid] = d
        return d

    for nid, n in ids.items():
        pid = n.get("parent") or (n.get("anchor") if n.get("optional") else None)
        if not pid:
            continue
        d = depth(nid)
        if pid not in ids:
            errs.append(f"node '{nid}': parent '{pid}' does not exist")
        elif d is None:
            errs.append(f"node '{nid}': parent '{pid}' creates a loop")
        elif d > MAX_DEPTH:
            errs.append(f"node '{nid}': sub-topics go at most {MAX_DEPTH} levels below a main topic")
        elif phases and n.get("phase") and ids[pid].get("phase") and n["phase"] != ids[pid]["phase"]:
            warns.append(f"node '{nid}': 'phase' ignored, it inherits the phase of its parent '{pid}'")
    if not core_ids:
        errs.append("needs at least one non-optional node")
    if core_phase_idx != sorted(core_phase_idx):
        errs.append("non-optional nodes must be listed in phase order (all of phase 1, then phase 2, ...)")
    for pid in phase_ids:
        if phases and not any(ids[c].get("phase") == pid for c in core_ids):
            warns.append(f"phase '{pid}' has no non-optional nodes and will not be shown")
    if len(core_ids) > 40:
        warns.append(f"{len(core_ids)} non-optional nodes; consider splitting into several roadmaps")
    validate_projects(data.get("projects"), ids, errs, warns)
    return errs, warns


def validate_links(links, w, errs):
    if not isinstance(links, list):
        errs.append(f"{w}: 'links' must be a list")
        return
    for j, l in enumerate(links):
        if not (isinstance(l, dict) and l.get("title") and re.match(r"^https?://", str(l.get("url", "")))):
            errs.append(f"{w}: links[{j}] needs 'title' and an http(s) 'url'")


def validate_projects(projects, node_ids, errs, warns):
    """Hands-on projects: optional, each one at a level and linked to the topics it practices."""
    if projects is None:
        return
    if not isinstance(projects, list):
        errs.append("'projects' must be a list")
        return
    seen, per_level = set(), {lv: 0 for lv in LEVELS}
    for i, p in enumerate(projects):
        w = f"projects[{i}]"
        if not isinstance(p, dict):
            errs.append(f"{w} must be an object")
            continue
        pid = p.get("id")
        w = f"projects[{i}] ({pid})"
        if not isinstance(pid, str) or not SLUG.match(pid):
            errs.append(f"{w}: 'id' must be a lowercase slug")
        elif pid in seen:
            errs.append(f"{w}: duplicate project id")
        else:
            seen.add(pid)
            if pid in node_ids:
                warns.append(f"{w}: same id as a node; it works, but a different id avoids confusion")
        for k in p:
            if k not in PROJECT_KEYS:
                warns.append(f"{w}: unknown key '{k}'")
        title = p.get("title")
        if not title:
            errs.append(f"{w}: 'title' is required")
        elif len(title) > 60:
            warns.append(f"{w}: title has {len(title)} chars; keep it short (<= 60)")
        if p.get("level") not in LEVELS:
            errs.append(f"{w}: 'level' must be one of {list(LEVELS)}")
        else:
            per_level[p["level"]] += 1
        for key in ("summary", "deliverable", "success", "time"):
            if key in p and not isinstance(p[key], str):
                errs.append(f"{w}: '{key}' must be a string")
        stretch = p.get("stretch", [])
        if not isinstance(stretch, list) or not all(isinstance(x, str) for x in stretch):
            errs.append(f"{w}: 'stretch' must be a list of strings")
        uses = p.get("uses", [])
        if not isinstance(uses, list) or not all(isinstance(x, str) for x in uses):
            errs.append(f"{w}: 'uses' must be a list of node ids")
            uses = []
        for nid in uses:
            if nid not in node_ids:
                errs.append(f"{w}: uses '{nid}', which is not a node")
            elif node_ids[nid].get("optional"):
                warns.append(f"{w}: uses the optional topic '{nid}'; it will count as a prerequisite anyway")
        reqs = p.get("requirements", [])
        if not isinstance(reqs, list):
            errs.append(f"{w}: 'requirements' must be a list")
            reqs = []
        req_ids = set()
        for j, r in enumerate(reqs):
            rw = f"{w}: requirements[{j}]"
            if not isinstance(r, dict):
                errs.append(f"{rw} must be an object")
                continue
            for k in r:
                if k not in REQ_KEYS:
                    warns.append(f"{rw}: unknown key '{k}'")
            if not r.get("title"):
                errs.append(f"{rw}: 'title' is required")
            if not isinstance(r.get("id"), str) or not SLUG.match(r["id"]):
                errs.append(f"{rw}: 'id' must be a lowercase slug")
            elif r["id"] in req_ids:
                errs.append(f"{rw}: duplicate requirement id '{r['id']}'")
            else:
                req_ids.add(r["id"])
        if not uses and not reqs:
            warns.append(f"{w}: no 'uses' and no 'requirements'; it looks unfinished")
        validate_links(p.get("links", []), w, errs)
    if len(projects) > 20:
        warns.append(f"{len(projects)} projects; a list this long is hard to choose from")
    for lv, count in per_level.items():
        if count > 8:
            warns.append(f"{count} {lv} projects; 8 per level is plenty")


def rel(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def is_user(path):
    try:
        path.relative_to(USER_DIR)
        return True
    except ValueError:
        return False


def read_hidden():
    try:
        v = json.loads(HIDDEN_FILE.read_text("utf-8"))
        return {x for x in v if isinstance(x, str)} if isinstance(v, list) else set()
    except (OSError, ValueError):
        return set()


def write_json(path, obj):
    """Atomic write: a crash never leaves a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def parent_of(n):
    return n.get("parent") or (n.get("anchor") if n.get("optional") else None)


def finished_by_default(n, kids):
    """Is this topic finished before any progress is saved? Its own status, or else all of its tasks and
    required sub-topics (the same rule the UI uses to derive a status)."""
    if n.get("status"):
        return n["status"] == "finished"
    parts = [t.get("status") == "finished" for t in n.get("tasks", []) if isinstance(t, dict)]
    parts += [finished_by_default(c, kids) for c in kids.get(n.get("id"), []) if not c.get("optional")]
    return bool(parts) and all(parts)


def manifest_text(user):
    entries, seen, hidden = [], {}, read_hidden() if user else set()
    for folder, path in roadmap_files():
        if not user and is_user(path):
            continue
        try:
            d = json.loads(path.read_text("utf-8"))
            title = d["meta"]["title"]
            rid = d["id"]
        except Exception as e:  # skip broken files; `check` reports them
            print(f"index: skipping {rel(path)} ({e})", file=sys.stderr)
            continue
        if rid in seen:
            print(f"index: duplicate id '{rid}' in {rel(path)} (also {seen[rid]}); skipped", file=sys.stderr)
            continue
        editable = is_user(path)
        seen[rid] = rel(path)
        nodes = [n for n in d.get("nodes", []) if isinstance(n, dict)]
        kids = {}
        for n in nodes:
            if parent_of(n):
                kids.setdefault(parent_of(n), []).append(n)
        core = [n for n in nodes if not n.get("optional") and not parent_of(n)]
        # a light index for the command palette: every topic with its phase, and every project with its level
        phase_title = {p.get("id"): p.get("title", "") for p in d.get("phases", []) if isinstance(p, dict)}
        by_id = {n.get("id"): n for n in nodes}

        def root_phase(n, seen=()):
            p = by_id.get(parent_of(n))
            return root_phase(p, seen + (n.get("id"),)) if p and p.get("id") not in seen else phase_title.get(n.get("phase"), "")

        search = {"t": [[n.get("id"), n.get("title", ""), root_phase(n)] for n in nodes if n.get("id") and n.get("title")]}
        projects = [p for p in d.get("projects", []) if isinstance(p, dict) and p.get("id") and p.get("title")] if isinstance(d.get("projects"), list) else []
        if projects:
            search["p"] = [[p["id"], p["title"], p.get("level", "")] for p in projects]
        entries.append({
            "id": rid, "file": f"user/{path.relative_to(USER_DIR).as_posix()}" if editable else seen[rid], "group": folder, "title": title,
            "description": d["meta"].get("description", ""), "icon": d["meta"].get("icon", ""),
            "language": d["meta"].get("language", ""),
            "phases": len(d.get("phases", [])),
            "topics": len(core),
            "optional": sum(1 for n in nodes if n.get("optional")),
            "subtopics": sum(1 for n in nodes if parent_of(n) and not n.get("optional")),
            "coreIds": [n.get("id") for n in core],
            "doneByDefault": [n.get("id") for n in core if finished_by_default(n, kids)],
            **({"projects": len(d["projects"])} if isinstance(d.get("projects"), list) and d["projects"] else {}),
            "search": search,
            **({"editable": True} if editable else {}),
            **({"hidden": True} if rid in hidden else {}),
        })
    langs = sorted(p.stem for p in LABELS_DIR.glob("*.json"))
    manifest = {
        "_note": "Generated by `python3 tools/roadkit.py index`. Do not edit by hand.",
        "groups": [{"id": g, "title": t} for g, t, _ in discover() if any(e["group"] == g for e in entries)],
        "languages": langs,
        "roadmaps": entries,
    }
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"


def build_manifest(write=True, user=True):
    """The roadmap list. `user` adds what lives in the data folder (roadmaps made in the UI, hidden ids). The copy
    written to disk never has it, so the committed manifest.json is the same for everyone."""
    text = manifest_text(user)
    if write:
        disk = manifest_text(False) if user else text
        if not MANIFEST.exists() or MANIFEST.read_text("utf-8") != disk:
            MANIFEST.write_text(disk, "utf-8")
    return text


def cmd_check(args):
    known = label_keys()
    targets = [Path(f).resolve() for f in args.files] if args.files else [p for _, p in roadmap_files()]
    failed, ids = False, {}
    for p in targets:
        name = rel(p)
        try:
            data = json.loads(p.read_text("utf-8"))
        except Exception as e:
            print(f"erro {name}\n    invalid JSON: {e}")
            failed = True
            continue
        errs, warns = validate(data, known)
        rid = data.get("id") if isinstance(data, dict) else None
        if rid in ids:
            errs.append(f"duplicate roadmap id '{rid}' (also in {ids[rid]})")
        elif rid:
            ids[rid] = name
        print(("erro " if errs else "ok   ") + name + ("" if errs or not warns else "  (warnings)"))
        for e in errs:
            print(f"    error: {e}")
        for w in warns:
            print(f"    warn:  {w}")
        failed |= bool(errs)
    if not failed:
        build_manifest()
        print("manifest.json up to date")
    return 1 if failed else 0


def valid_project_state(v):
    """{"status": one of STATUSES, "repo": "https://...", "req": {requirement id: bool}, "stretch": {challenge id: bool}},
    every field optional."""
    if not isinstance(v, dict) or set(v) - {"status", "repo", "req", "stretch"}:
        return False
    if "status" in v and v["status"] not in STATUSES:
        return False
    repo = v.get("repo", "")
    if not isinstance(repo, str) or len(repo) > MAX_REPO_URL or (repo and not re.match(r"^https?://", repo)):
        return False
    flags = [v.get("req", {}), v.get("stretch", {})]
    return all(isinstance(m, dict) and all(isinstance(k, str) and isinstance(b, bool) for k, b in m.items()) for m in flags)


def valid_state(obj):
    """Progress payload: {"updatedAt": ms, "state": {"nodes": {id: status}, "tasks": {key: status},
    "projects": {id: {...}}}}. Other keys in "state" are accepted as objects and kept, so a newer client
    can store more without an older server (or client) dropping it."""
    if not isinstance(obj, dict) or not isinstance(obj.get("updatedAt"), (int, float)):
        return False
    st = obj.get("state")
    if not isinstance(st, dict):
        return False
    for part in ("nodes", "tasks"):
        m = st.get(part, {})
        if not isinstance(m, dict) or any(not isinstance(k, str) or v not in STATUSES for k, v in m.items()):
            return False
    projects = st.get("projects", {})
    if not isinstance(projects, dict) or not all(isinstance(k, str) and valid_project_state(v) for k, v in projects.items()):
        return False
    return all(isinstance(v, dict) for v in st.values())


def valid_notes(obj):
    """Notes payload: {"updatedAt": ms, "notes": {"roadmap" | "node:<id>" | "project:<id>": markdown}}."""
    if not isinstance(obj, dict) or not isinstance(obj.get("updatedAt"), (int, float)):
        return False
    notes = obj.get("notes")
    return isinstance(notes, dict) and all(
        isinstance(k, str) and NOTE_KEY.match(k) and isinstance(v, str) and len(v) <= MAX_NOTE_CHARS for k, v in notes.items())


"""Activity: data/activity/<id>.json keeps totals per day ("moves", "done") and, per topic or project
("project:<id>"), when it started, finished and was last touched. Its size depends on the number of topics and
on two years of days, never on how much you click; nothing stays in memory between requests."""
DAY_TOTALS = ("moves", "done", "focus")


def local_day(ms, tz):
    """The day of a moment (ms) where the client is: tz is its offset in minutes east of UTC, when it sent one."""
    if isinstance(tz, int) and not isinstance(tz, bool) and -840 <= tz <= 840:
        return datetime.fromtimestamp(ms / 1000 + tz * 60, timezone.utc).strftime("%Y-%m-%d")
    return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d")


def read_activity(rid):
    try:
        v = json.loads((ACTIVITY_DIR / f"{rid}.json").read_text("utf-8"))
    except (OSError, ValueError):
        v = None
    out = {"v": 1, "days": {}, "months": {}, "topics": {}}
    if isinstance(v, dict):
        for part in ("days", "months", "topics"):
            if isinstance(v.get(part), dict):
                out[part] = {k: x for k, x in v[part].items() if isinstance(k, str) and isinstance(x, dict)}
    return out


def compact_activity(act, today):
    """Days older than ACTIVITY_DAYS are folded into totals per month."""
    cutoff = (date.fromisoformat(today) - timedelta(days=ACTIVITY_DAYS)).isoformat()
    for day in [d for d in act["days"] if d < cutoff]:
        month = act["months"].setdefault(day[:7], {})
        for k, n in act["days"].pop(day).items():
            if k in DAY_TOTALS and isinstance(n, (int, float)):
                month[k] = month.get(k, 0) + n


def record_activity(rid, old, new, at, tz):
    """Adds what changed between two saved progresses to the roadmap's activity, on the day it happened."""
    at = min(int(at), int(datetime.now(timezone.utc).timestamp() * 1000) + 300_000)   # a clock ahead does not write the future
    day = local_day(at, tz)
    moves = []   # (key, before, after) for topics and projects
    for k in set(old.get("nodes", {})) | set(new.get("nodes", {})):
        a, b = old.get("nodes", {}).get(k), new.get("nodes", {}).get(k)
        if a != b:
            moves.append((k, a, b))
    po, pn = old.get("projects", {}), new.get("projects", {})
    touched, minor = set(), 0
    for k in set(po) | set(pn):
        a, b = po.get(k) or {}, pn.get(k) or {}
        if a.get("status") != b.get("status"):
            moves.append((f"project:{k}", a.get("status"), b.get("status")))
        checks = sum(1 for part in ("req", "stretch") for c in set(a.get(part, {})) | set(b.get(part, {}))
                     if a.get(part, {}).get(c) != b.get(part, {}).get(c))
        if checks:
            minor += checks
            touched.add(f"project:{k}")
    for k in set(old.get("tasks", {})) | set(new.get("tasks", {})):
        if old.get("tasks", {}).get(k) != new.get("tasks", {}).get(k):
            minor += 1
            touched.add(k.rsplit("/", 1)[0])
    if not moves and not minor:
        return
    act = read_activity(rid)
    totals = act["days"].setdefault(day, {})
    emptied = not any(new.get(p) for p in ("nodes", "tasks", "projects"))
    if emptied:   # "reset marks": one move, and nothing counts as started or finished any more
        totals["moves"] = totals.get("moves", 0) + 1
        for t in act["topics"].values():
            t.pop("started", None)
            t.pop("finished", None)
    else:
        totals["moves"] = totals.get("moves", 0) + len(moves) + minor
        for k, a, b in moves:
            t = act["topics"].setdefault(k, {})
            t["touched"] = at
            if b in ("working", "review", "finished"):
                t.setdefault("started", day)
            if b == "finished":
                t["finished"] = day
                totals["done"] = totals.get("done", 0) + 1
            elif b in (None, "todo"):
                t.pop("started", None)
                t.pop("finished", None)
            else:
                t.pop("finished", None)
        for k in touched:
            act["topics"].setdefault(k, {})["touched"] = at
    compact_activity(act, day)
    write_json(ACTIVITY_DIR / f"{rid}.json", act)


class ApiError(Exception):
    def __init__(self, code, body):
        self.code, self.body = code, body


CATEGORY_PART = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")


def user_file(rid):
    """The file of a roadmap made in the UI, wherever its category put it."""
    if not slug_ok(rid) or not USER_DIR.is_dir():
        return None
    for f in USER_DIR.rglob(f"{rid}.json"):
        if f.is_file() and not any(x.startswith((".", "_")) for x in f.relative_to(USER_DIR).parts):
            return f
    return None


def slug_ok(rid):
    return isinstance(rid, str) and bool(SLUG.match(rid)) and len(rid) <= 100


def known_ids():
    return {e["id"]: e for e in json.loads(build_manifest(write=False))["roadmaps"]}


def private_path(path):
    """Folders that are never served as static files. The check runs on the decoded, normalized path,
    the same one the static server would open, so '/%64ata/...' or '/x/../data/...' cannot get around it."""
    parts = [p for p in posixpath.normpath(unquote(path)).split("/") if p]
    return bool(parts) and (parts[0].startswith(".git") or parts[0] in ("tools", "data"))


SW_SOURCE = ROOT / "src" / "sw.js"


def app_version():
    """A short hash of the interface files. The service worker carries it, so any change to the app (a
    release, or an edit while developing) makes browsers install the new interface once and drop the old."""
    h = hashlib.sha256()
    for f in sorted([ROOT / "index.html", *(p for p in (ROOT / "src").rglob("*") if p.is_file())]):
        h.update(f.relative_to(ROOT).as_posix().encode())
        h.update(f.read_bytes())
    return h.hexdigest()[:12]


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml"}

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/"):
            return self.api("GET", path)
        if path == "/sw.js":
            return self.serve_worker()
        if path.startswith("/user/"):                 # roadmaps created in the UI live in the data folder
            return self.serve_user_file(path)
        if private_path(path):
            return self.send_error(404)
        if path == "/manifest.json":
            return self.send_text(build_manifest())
        super().do_GET()

    def do_HEAD(self):
        if private_path(self.path.split("?")[0]):
            return self.send_error(404)
        if self.path.split("?")[0] == "/sw.js":
            return self.serve_worker()
        super().do_HEAD()

    def do_PUT(self):
        self.route_api("PUT")

    def do_POST(self):
        self.route_api("POST")

    def do_DELETE(self):
        self.route_api("DELETE")

    def route_api(self, method):
        path = self.path.split("?")[0]
        self.api(method, path) if path.startswith("/api/") else self.send_error(405)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_text(self, text):
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_worker(self):
        """The service worker lives in src/ but is served from the root, so it can control the whole app."""
        body = SW_SOURCE.read_text("utf-8").replace("__ROADKIT_VERSION__", app_version()).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Service-Worker-Allowed", "/")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def serve_user_file(self, path):
        name = unquote(path[len("/user/"):])
        parts = name.split("/")
        f = USER_DIR.joinpath(*parts)
        if any(not x or x.startswith((".", "_")) for x in parts) or not name.endswith(".json") or not f.is_file():
            return self.send_error(404)
        body = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- JSON API (same-origin only, optional bearer token) ----
    def reply(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        if body:
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def api_allowed(self):
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            self.reply(403, {"error": "cross-origin request refused"})
            return False
        if TOKEN:
            sent = self.headers.get("Authorization", "")
            if not hmac.compare_digest(sent.encode(), f"Bearer {TOKEN}".encode()):
                self.reply(401, {"error": "token required"})
                return False
        return True

    def read_json(self):
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            raise ApiError(415, {"error": "send application/json"})
        try:
            size = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            size = -1
        if not 0 < size <= MAX_STATE_BYTES:
            raise ApiError(413, {"error": "bad or oversized body"})
        try:
            return json.loads(self.rfile.read(size))
        except ValueError:
            raise ApiError(400, {"error": "invalid JSON"})

    def api(self, method, path):
        if not self.api_allowed():
            return
        query = parse_qs(urlsplit(self.path).query)
        try:
            for pattern, verbs in ROUTES:
                m = re.fullmatch(pattern, path)
                if m:
                    if method not in verbs:
                        raise ApiError(405, {"error": "method not allowed"})
                    return self.reply(*getattr(self, verbs[method])(unquote(m.group(1)) if m.groups() else None, query))
            raise ApiError(404, {"error": "unknown endpoint"})
        except ApiError as e:
            self.reply(e.code, e.body)
        except OSError as e:
            self.reply(500, {"error": f"disk error: {e.strerror}"})

    # -- progress: GET/PUT /api/state/<id>, GET /api/states --
    def state_file(self, rid):
        if not STATE_ID.match(rid or ""):
            raise ApiError(404, {"error": "unknown roadmap id"})
        return DATA_DIR / f"{rid}.json"

    def state_get(self, rid, query):
        f = self.state_file(rid)
        try:
            return 200, json.loads(f.read_text("utf-8"))
        except FileNotFoundError:
            return 204, None
        except ValueError:
            raise ApiError(500, {"error": "saved progress is unreadable"})

    def state_put(self, rid, query):
        f = self.state_file(rid)
        incoming = self.read_json()
        if not valid_state(incoming):
            raise ApiError(400, {"error": "invalid progress payload"})
        with LOCK:
            try:
                current = json.loads(f.read_text("utf-8"))
            except (OSError, ValueError):
                current = None
            if valid_state(current) and current["updatedAt"] > incoming["updatedAt"]:
                return 409, current  # the server already has newer progress; the client adopts it
            # keys the client did not send (an older client knows only nodes and tasks) stay as they were
            kept = current["state"] if valid_state(current) else {}
            out = {"updatedAt": incoming["updatedAt"], "state": {
                **kept, "nodes": {}, "tasks": {}, **incoming["state"]}}
            write_json(f, out)
            if valid_state(current):   # a first upload (progress made before syncing) is not today's activity
                try:
                    record_activity(rid, current["state"], out["state"], incoming["updatedAt"], incoming.get("tz"))
                except (OSError, ValueError) as e:   # the progress is saved; the activity failing must not undo that
                    print(f"activity: {rid}: {e}", file=sys.stderr)
        return 200, out

    # -- notes: GET/PUT /api/notes/<id>, the same sync rules as the progress, in a file of their own --
    def notes_file(self, rid):
        if not STATE_ID.match(rid or ""):
            raise ApiError(404, {"error": "unknown roadmap id"})
        return NOTES_DIR / f"{rid}.json"

    def notes_get(self, rid, query):
        f = self.notes_file(rid)
        try:
            return 200, json.loads(f.read_text("utf-8"))
        except FileNotFoundError:
            return 204, None
        except ValueError:
            raise ApiError(500, {"error": "saved notes are unreadable"})

    def notes_put(self, rid, query):
        f = self.notes_file(rid)
        incoming = self.read_json()   # the body limit (1 MB) also caps the notes of one roadmap
        if not valid_notes(incoming):
            raise ApiError(400, {"error": f"invalid notes payload (each note up to {MAX_NOTE_CHARS} characters)"})
        with LOCK:
            try:
                current = json.loads(f.read_text("utf-8"))
            except (OSError, ValueError):
                current = None
            if valid_notes(current) and current["updatedAt"] > incoming["updatedAt"]:
                return 409, current
            out = {"updatedAt": incoming["updatedAt"], "notes": {k: v for k, v in incoming["notes"].items() if v.strip()}}
            write_json(f, out)
        return 200, out

    def states_get(self, _, query):
        out = {}
        for f in DATA_DIR.glob("*.json") if DATA_DIR.is_dir() else []:
            try:
                v = json.loads(f.read_text("utf-8"))
            except (OSError, ValueError):
                continue
            if STATE_ID.match(f.stem) and valid_state(v):
                st = v["state"]
                out[f.stem] = {"updatedAt": v["updatedAt"], "nodes": st.get("nodes", {}), "tasks": st.get("tasks", {}),
                               "projects": {k: {"status": p["status"]} for k, p in st.get("projects", {}).items() if p.get("status")},
                               "dates": st.get("dates", {})}
        return 200, out

    # -- activity: GET /api/activity?days=30 (all roadmaps, for the Today screen), GET /api/activity/<id> --
    def activity_all(self, _, query):
        try:
            days = max(1, min(ACTIVITY_DAYS, int(query.get("days", ["30"])[0])))
        except ValueError:
            raise ApiError(400, {"error": "days must be a number"})
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        totals, roadmaps = {}, {}
        for f in ACTIVITY_DIR.glob("*.json") if ACTIVITY_DIR.is_dir() else []:
            if not STATE_ID.match(f.stem):
                continue
            act = read_activity(f.stem)
            for day, t in act["days"].items():
                if day >= cutoff:
                    into = totals.setdefault(day, {})
                    for k in DAY_TOTALS:
                        if isinstance(t.get(k), (int, float)):
                            into[k] = into.get(k, 0) + t[k]
            topics = {k: {x: t[x] for x in ("touched", "started", "finished") if x in t} for k, t in act["topics"].items()}
            last = max((t.get("touched", 0) for t in topics.values() if isinstance(t.get("touched"), (int, float))), default=0)
            roadmaps[f.stem] = {"last": last, "topics": topics}
        return 200, {"days": totals, "roadmaps": roadmaps}

    def activity_get(self, rid, query):
        if not STATE_ID.match(rid or ""):
            raise ApiError(404, {"error": "unknown roadmap id"})
        if not (ACTIVITY_DIR / f"{rid}.json").is_file():
            return 204, None
        return 200, read_activity(rid)

    # -- roadmaps made in the UI: POST /api/roadmaps, PUT/DELETE /api/roadmaps/<id>; ?category=<path>&categoryTitle=<name> --
    def check_roadmap(self, data):
        errs, warns = validate(data, label_keys())
        if errs:
            raise ApiError(422, {"errors": errs, "warnings": warns})
        return warns

    def category_target(self, query):
        """Folder chosen with ?category=, or None when the request does not mention one."""
        if "category" not in query:
            return None
        parts = [x for x in query["category"][0].split("/") if x]
        if len(parts) > 3 or any(not CATEGORY_PART.match(x) for x in parts):
            raise ApiError(400, {"error": "category must be up to 3 folder names like 'estudos' or 'work/golang'"})
        folder = USER_DIR.joinpath(*parts)
        title = (query.get("categoryTitle", [""])[0] or "").strip()[:80]
        if parts and title and not folder.exists():
            folder.mkdir(parents=True, exist_ok=True)
            write_json(folder / "_section.json", {"title": title})
        return folder

    def roadmap_validate(self, _, query):
        """Same rules as `check`, without saving: lets the editor lint a draft while you type."""
        errs, warns = validate(self.read_json(), label_keys())
        return 200, {"errors": errs, "warnings": warns}

    def roadmap_create(self, _, query):
        data = self.read_json()
        warns = self.check_roadmap(data)
        folder = self.category_target(query) or USER_DIR
        with LOCK:
            if data["id"] in known_ids():
                raise ApiError(409, {"error": f"a roadmap with id '{data['id']}' already exists"})
            write_json(folder / f"{data['id']}.json", data)
        return 201, {"id": data["id"], "warnings": warns}

    def roadmap_update(self, rid, query):
        data = self.read_json()
        current = user_file(rid)
        if current is None:
            raise ApiError(404, {"error": "only roadmaps created in the interface can be edited"})
        if not isinstance(data, dict) or data.get("id") != rid:
            raise ApiError(400, {"error": "the id of a roadmap cannot change (it keys the saved progress)"})
        warns = self.check_roadmap(data)
        folder = self.category_target(query) or current.parent
        with LOCK:
            write_json(folder / f"{rid}.json", data)
            if folder / f"{rid}.json" != current:   # moved to another category
                current.unlink()
        return 200, {"id": rid, "warnings": warns}

    def roadmap_delete(self, rid, query):
        f = user_file(rid)
        if f is None:
            raise ApiError(405 if rid in known_ids() else 404, {"error": "only roadmaps created in the interface can be deleted; hide the others"})
        with LOCK:
            f.unlink()
            if query.get("progress", [""])[0] == "1":   # the progress, the notes and the activity go together
                for path in (self.state_file, self.notes_file, lambda r: ACTIVITY_DIR / f"{r}.json"):
                    try:
                        path(rid).unlink()
                    except (FileNotFoundError, ApiError):
                        pass
            hidden = read_hidden()
            if rid in hidden:
                write_json(HIDDEN_FILE, sorted(hidden - {rid}))
        return 200, {"id": rid}

    def hidden_put(self, rid, query):
        body = self.read_json()
        if not slug_ok(rid) or not isinstance(body, dict) or not isinstance(body.get("hidden"), bool):
            raise ApiError(400, {"error": 'send {"hidden": true|false}'})
        with LOCK:
            hidden = read_hidden()
            hidden = hidden | {rid} if body["hidden"] else hidden - {rid}
            write_json(HIDDEN_FILE, sorted(hidden))
        return 200, {"id": rid, "hidden": body["hidden"]}


ROUTES = [
    (r"/api/state/([^/]+)", {"GET": "state_get", "PUT": "state_put"}),
    (r"/api/states", {"GET": "states_get"}),
    (r"/api/notes/([^/]+)", {"GET": "notes_get", "PUT": "notes_put"}),
    (r"/api/activity", {"GET": "activity_all"}),
    (r"/api/activity/([^/]+)", {"GET": "activity_get"}),
    (r"/api/validate", {"POST": "roadmap_validate"}),
    (r"/api/roadmaps", {"POST": "roadmap_create"}),
    (r"/api/roadmaps/([^/]+)", {"PUT": "roadmap_update", "DELETE": "roadmap_delete"}),
    (r"/api/hidden/([^/]+)", {"PUT": "hidden_put"}),
]


def cmd_serve(args):
    build_manifest()
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as srv:
        print(f"Roadkit: http://localhost:{args.port}  (Ctrl+C to stop)")
        print(f"progress is saved in {DATA_DIR}" + ("  (API token required)" if TOKEN else ""))
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--host", default="127.0.0.1")
    s.set_defaults(fn=cmd_serve)
    c = sub.add_parser("check")
    c.add_argument("files", nargs="*")
    c.set_defaults(fn=cmd_check)
    i = sub.add_parser("index")
    i.set_defaults(fn=lambda a: (build_manifest(), print("manifest.json updated"), 0)[2])
    args = ap.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()
