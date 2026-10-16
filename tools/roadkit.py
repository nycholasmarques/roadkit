#!/usr/bin/env python3
"""Roadkit CLI (stdlib only).

  python3 tools/roadkit.py serve [--port 8765] [--host 127.0.0.1]   serve the UI (manifest.json is rebuilt on every load)
  python3 tools/roadkit.py check [file.json ...]                    validate roadmaps and rebuild manifest.json
  python3 tools/roadkit.py index                                    rebuild manifest.json only
"""
import argparse
import functools
import http.server
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROUPS = [("roadmaps", "Meus roadmaps"), ("examples", "Exemplos")]  # scanned folders, in display order
MANIFEST = ROOT / "manifest.json"
LABELS_DIR = ROOT / "src" / "labels"

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
TOP_KEYS = {"$schema", "schemaVersion", "id", "meta", "theme", "labels", "phases", "nodes"}
META_KEYS = {"title", "eyebrow", "subtitle", "description", "icon", "language", "brand", "tagline", "sidebarNote", "footer"}
THEME_KEYS = {"accent", "brandAccent"}
PHASE_KEYS = {"id", "title", "summary", "period", "color", "milestone"}
NODE_KEYS = {"id", "title", "phase", "time", "summary", "topics", "challenge", "success", "links", "optional", "anchor"}


def roadmap_files():
    for folder, _ in GROUPS:
        d = ROOT / folder
        if d.is_dir():
            for p in sorted(d.glob("*.json")):
                if not p.name.startswith("_"):
                    yield folder, p


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


def build_manifest(write=True):
    entries, seen = [], {}
    for folder, path in roadmap_files():
        try:
            d = json.loads(path.read_text("utf-8"))
            title = d["meta"]["title"]
            rid = d["id"]
        except Exception as e:  # skip broken files; `check` reports them
            print(f"index: skipping {path.relative_to(ROOT)} ({e})", file=sys.stderr)
            continue
        if rid in seen:
            print(f"index: duplicate id '{rid}' in {path.relative_to(ROOT)} (also {seen[rid]}); skipped", file=sys.stderr)
            continue
        seen[rid] = path.relative_to(ROOT).as_posix()
        nodes = d.get("nodes", [])
        entries.append({
            "id": rid, "file": seen[rid], "group": folder, "title": title,
            "description": d["meta"].get("description", ""), "icon": d["meta"].get("icon", ""),
            "phases": len(d.get("phases", [])),
            "topics": sum(1 for n in nodes if not n.get("optional")),
            "optional": sum(1 for n in nodes if n.get("optional")),
        })
    langs = sorted(p.stem for p in LABELS_DIR.glob("*.json"))
    manifest = {
        "_note": "Generated by `python3 tools/roadkit.py index`. Do not edit by hand.",
        "groups": [{"id": g, "title": t} for g, t in GROUPS],
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
        try:
            rel = p.relative_to(ROOT).as_posix()
        except ValueError:
            rel = str(p)
        try:
            data = json.loads(p.read_text("utf-8"))
        except Exception as e:
            print(f"erro {rel}\n    invalid JSON: {e}")
            failed = True
            continue
        errs, warns = validate(data, known)
        rid = data.get("id") if isinstance(data, dict) else None
        if rid in ids:
            errs.append(f"duplicate roadmap id '{rid}' (also in {ids[rid]})")
        elif rid:
            ids[rid] = rel
        print(("erro " if errs else "ok   ") + rel + ("" if errs or not warns else "  (warnings)"))
        for e in errs:
            print(f"    error: {e}")
        for w in warns:
            print(f"    warn:  {w}")
        failed |= bool(errs)
    if not failed:
        build_manifest()
        print("manifest.json up to date")
    return 1 if failed else 0


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/.git") or path.startswith("/tools"):
            return self.send_error(404)
        if path == "/manifest.json":
            build_manifest()
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def cmd_serve(args):
    build_manifest()
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as srv:
        print(f"Roadkit: http://localhost:{args.port}  (Ctrl+C to stop)")
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
