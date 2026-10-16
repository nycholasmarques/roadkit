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
import http.server
import hmac
import json
import os
import re
import sys
import tempfile
import threading
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

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
TOP_KEYS = {"$schema", "schemaVersion", "id", "meta", "theme", "labels", "phases", "nodes"}
META_KEYS = {"title", "eyebrow", "subtitle", "description", "icon", "language", "brand", "tagline", "sidebarNote", "footer", "defaultView"}
THEME_KEYS = {"accent", "brandAccent"}
PHASE_KEYS = {"id", "title", "summary", "period", "color", "milestone"}
NODE_KEYS = {"id", "title", "phase", "time", "summary", "topics", "challenge", "success", "links", "optional", "anchor", "status", "tasks"}
STATUSES = ("todo", "working", "review", "finished")
TASK_KEYS = {"id", "title", "note", "status"}


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
            print(f"warn: {meta.relative_to(ROOT).as_posix()} needs a non-empty 'title'", file=sys.stderr)
        except (OSError, ValueError, AttributeError) as e:
            print(f"warn: {meta.relative_to(ROOT).as_posix()} is not valid ({e})", file=sys.stderr)
    return pretty(folder.name)


def json_files(folder):
    return sorted(p for p in folder.glob("*.json") if not p.name.startswith("_"))


def discover():
    """Sections in display order: (group id, title, files). Every folder below roadmaps/ is a section,
    at any depth; folders starting with '.' or '_' are ignored. Examples come last."""
    out = []
    root_files = (json_files(ROADMAPS) if ROADMAPS.is_dir() else []) + (json_files(USER_DIR) if USER_DIR.is_dir() else [])
    if root_files:
        out.append(("roadmaps", ROOT_TITLE, root_files))
    if ROADMAPS.is_dir():
        folders = sorted(
            (d for d in ROADMAPS.rglob("*")
             if d.is_dir() and not any(part.startswith((".", "_")) for part in d.relative_to(ROADMAPS).parts)),
            key=lambda d: d.relative_to(ROADMAPS).as_posix().lower(),
        )
        for d in folders:
            files = json_files(d)
            if not files:
                continue
            rel = d.relative_to(ROADMAPS)
            gid = "roadmaps/" + rel.as_posix()
            title = " / ".join(section_title(ROADMAPS.joinpath(*rel.parts[: i + 1])) for i in range(len(rel.parts)))
            out.append((gid, title, files))
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
    phase_ids = []
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
        if phases:
            if n.get("phase") not in phase_ids:
                errs.append(f"{w}: 'phase' must be one of {phase_ids}")
        elif "phase" in n:
            warns.append(f"{w}: 'phase' ignored because the roadmap defines no phases")
        for key in ("topics",):
            v = n.get(key, [])
            if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
                errs.append(f"{w}: '{key}' must be a list of strings")
        for key in ("time", "summary", "challenge", "success"):
            if key in n and not isinstance(n[key], str):
                errs.append(f"{w}: '{key}' must be a string")
        links = n.get("links", [])
        if not isinstance(links, list):
            errs.append(f"{w}: 'links' must be a list")
        else:
            for j, l in enumerate(links):
                if not (isinstance(l, dict) and l.get("title") and re.match(r"^https?://", str(l.get("url", "")))):
                    errs.append(f"{w}: links[{j}] needs 'title' and an http(s) 'url'")
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
        if n.get("optional"):
            if not n.get("anchor"):
                errs.append(f"{w}: optional nodes need an 'anchor' (id of a core node)")
        else:
            if "anchor" in n:
                warns.append(f"{w}: 'anchor' only applies to optional nodes")
            core_ids.append(nid)
            if phases and n.get("phase") in phase_ids:
                core_phase_idx.append(phase_ids.index(n["phase"]))
    for nid, n in ids.items():
        if n.get("optional") and n.get("anchor"):
            a = ids.get(n["anchor"])
            if a is None or a.get("optional"):
                errs.append(f"node '{nid}': anchor '{n['anchor']}' must be the id of a non-optional node")
    if not core_ids:
        errs.append("needs at least one non-optional node")
    if core_phase_idx != sorted(core_phase_idx):
        errs.append("non-optional nodes must be listed in phase order (all of phase 1, then phase 2, ...)")
    for pid in phase_ids:
        if phases and not any(ids[c].get("phase") == pid for c in core_ids):
            warns.append(f"phase '{pid}' has no non-optional nodes and will not be shown")
    if len(core_ids) > 40:
        warns.append(f"{len(core_ids)} non-optional nodes; consider splitting into several roadmaps")
    return errs, warns


def rel(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


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


def default_finished(n):
    """Is this topic finished before any progress is saved? (its own status, or all of its tasks)"""
    if n.get("status"):
        return n["status"] == "finished"
    tasks = [t for t in n.get("tasks", []) if isinstance(t, dict)]
    return bool(tasks) and all(t.get("status") == "finished" for t in tasks)


def build_manifest(write=True):
    entries, seen, hidden = [], {}, read_hidden()
    for folder, path in roadmap_files():
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
        editable = path.parent == USER_DIR
        seen[rid] = rel(path)
        nodes = [n for n in d.get("nodes", []) if isinstance(n, dict)]
        core = [n for n in nodes if not n.get("optional")]
        entries.append({
            "id": rid, "file": f"user/{path.name}" if editable else seen[rid], "group": folder, "title": title,
            "description": d["meta"].get("description", ""), "icon": d["meta"].get("icon", ""),
            "language": d["meta"].get("language", ""),
            "phases": len(d.get("phases", [])),
            "topics": len(core),
            "optional": len(nodes) - len(core),
            "coreIds": [n.get("id") for n in core],
            "doneByDefault": [n.get("id") for n in core if default_finished(n)],
            **({"editable": True} if editable else {}),
            **({"hidden": True} if rid in hidden else {}),
        })
    langs = sorted(p.stem for p in LABELS_DIR.glob("*.json"))
    manifest = {
        "_note": "Generated by `python3 tools/roadkit.py index`. Do not edit by hand.",
        "groups": [{"id": g, "title": t} for g, t, _ in discover()],
        "languages": langs,
        "roadmaps": entries,
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if write and (not MANIFEST.exists() or MANIFEST.read_text("utf-8") != text):
        MANIFEST.write_text(text, "utf-8")
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


def valid_state(obj):
    """Progress payload: {"updatedAt": ms, "state": {"nodes": {id: status}, "tasks": {key: status}}}."""
    if not isinstance(obj, dict) or not isinstance(obj.get("updatedAt"), (int, float)):
        return False
    st = obj.get("state")
    if not isinstance(st, dict):
        return False
    for part in ("nodes", "tasks"):
        m = st.get(part, {})
        if not isinstance(m, dict) or any(not isinstance(k, str) or v not in STATUSES for k, v in m.items()):
            return False
    return True


class ApiError(Exception):
    def __init__(self, code, body):
        self.code, self.body = code, body


def slug_ok(rid):
    return isinstance(rid, str) and bool(SLUG.match(rid)) and len(rid) <= 100


def known_ids():
    return {e["id"]: e for e in json.loads(build_manifest(write=False))["roadmaps"]}


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/"):
            return self.api("GET", path)
        if path.startswith("/user/"):                 # roadmaps created in the UI live in the data folder
            return self.serve_user_file(path)
        if path.startswith(("/.git", "/tools", "/data")):
            return self.send_error(404)
        if path == "/manifest.json":
            build_manifest()
        super().do_GET()

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

    def serve_user_file(self, path):
        name = unquote(path[len("/user/"):])
        f = USER_DIR / name
        if "/" in name or not name.endswith(".json") or name.startswith(("_", ".")) or not f.is_file():
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
            out = {"updatedAt": incoming["updatedAt"], "state": {
                "nodes": incoming["state"].get("nodes", {}), "tasks": incoming["state"].get("tasks", {})}}
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
                out[f.stem] = {"updatedAt": v["updatedAt"], "nodes": v["state"].get("nodes", {})}
        return 200, out

    # -- roadmaps made in the UI: POST /api/roadmaps, PUT/DELETE /api/roadmaps/<id> --
    def check_roadmap(self, data):
        errs, warns = validate(data, label_keys())
        if errs:
            raise ApiError(422, {"errors": errs, "warnings": warns})
        return warns

    def roadmap_create(self, _, query):
        data = self.read_json()
        warns = self.check_roadmap(data)
        with LOCK:
            if data["id"] in known_ids():
                raise ApiError(409, {"error": f"a roadmap with id '{data['id']}' already exists"})
            write_json(USER_DIR / f"{data['id']}.json", data)
        return 201, {"id": data["id"], "warnings": warns}

    def roadmap_update(self, rid, query):
        data = self.read_json()
        if not slug_ok(rid) or not (USER_DIR / f"{rid}.json").is_file():
            raise ApiError(404, {"error": "only roadmaps created in the interface can be edited"})
        if not isinstance(data, dict) or data.get("id") != rid:
            raise ApiError(400, {"error": "the id of a roadmap cannot change (it keys the saved progress)"})
        warns = self.check_roadmap(data)
        with LOCK:
            write_json(USER_DIR / f"{rid}.json", data)
        return 200, {"id": rid, "warnings": warns}

    def roadmap_delete(self, rid, query):
        f = USER_DIR / f"{rid}.json" if slug_ok(rid) else None
        if f is None or not f.is_file():
            raise ApiError(405 if rid in known_ids() else 404, {"error": "only roadmaps created in the interface can be deleted; hide the others"})
        with LOCK:
            f.unlink()
            if query.get("progress", [""])[0] == "1":
                try:
                    self.state_file(rid).unlink()
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
