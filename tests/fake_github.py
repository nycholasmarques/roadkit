"""A tiny stand-in for the GitHub API, over TLS on 127.0.0.1, with Git objects kept in memory.

It implements only what the sync uses (repo info, refs, commits, recursive trees, blobs, Contents PUT for an empty
repository) plus a few test routes. The certificate is made at start with `openssl` (never stored in the repo).
"""
import base64
import hashlib
import json
import os
import shutil
import ssl
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

import helpers  # noqa: F401
from roadkit_sync.layout import blob_sha

HAVE_OPENSSL = bool(shutil.which("openssl"))


_CERT = {}


def make_cert(folder):
    """One certificate per test run (making an RSA key is the slow part)."""
    if _CERT:
        return _CERT["cert"], _CERT["key"]
    folder = tempfile.mkdtemp(prefix="fakegh-")
    key, cert = os.path.join(folder, "key.pem"), os.path.join(folder, "cert.pem")
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert,
                    "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"],
                   check=True, capture_output=True)
    _CERT.update(cert=cert, key=key)
    return cert, key


class FakeGitHub:
    def __init__(self, token="github_pat_TESTTOKEN123", owner="me", repo="data", branch="main", private=True, push=True):
        self.token, self.owner, self.repo, self.branch = token, owner, repo, branch
        self.private, self.push = private, push
        self.blobs, self.trees, self.commits, self.refs = {}, {}, {}, {}
        self.requests, self.lock = [], threading.Lock()
        self.before_patch = None
        self.expiration = "2030-01-31 10:00:00 UTC"
        self._dir = tempfile.TemporaryDirectory()
        cert, key = make_cert(self._dir.name)
        self.cafile = cert
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self.server.socket = ctx.wrap_socket(self.server.socket, server_side=True)
        self.base = f"https://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self._dir.cleanup()

    def client_context(self):
        return ssl.create_default_context(cafile=self.cafile)

    # -- Git objects --
    def _id(self, obj):
        return hashlib.sha1(json.dumps(obj, sort_keys=True).encode()).hexdigest()

    def add_blob(self, data):
        sha = blob_sha(data)
        self.blobs[sha] = data
        return sha

    def commit_files(self, files, message="seed", modes=None):
        """Test helper: a commit with exactly these files ({path: bytes}) on top of the branch."""
        flat = {p: ((modes or {}).get(p, "100644"), self.add_blob(d)) for p, d in files.items()}
        tree = self._id(flat)
        self.trees[tree] = flat
        parent = self.refs.get(self.branch)
        c = self._id({"tree": tree, "parents": [parent] if parent else [], "m": message, "n": len(self.commits)})
        self.commits[c] = {"tree": tree, "parents": [parent] if parent else [], "message": message}
        self.refs[self.branch] = c
        return c

    def files(self):
        head = self.refs.get(self.branch)
        return {p: self.blobs[s] for p, (m, s) in self.trees[self.commits[head]["tree"]].items()} if head else {}

    def history(self):
        out, c = [], self.refs.get(self.branch)
        while c:
            out.append(self.commits[c]["message"])
            c = (self.commits[c]["parents"] or [None])[0]
        return out

    # -- HTTP --
    def _handler(self):
        gh = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def send(self, code, obj=None, headers=None, raw=None):
                body = raw if raw is not None else (b"" if obj is None else json.dumps(obj).encode())
                self.send_response(code)
                for k, v in (headers or {}).items():
                    self.send_header(k, v)
                self.send_header("github-authentication-token-expiration", gh.expiration)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def body(self):
                n = int(self.headers.get("Content-Length") or 0)
                return json.loads(self.rfile.read(n)) if n else None

            def handle_any(self, method):
                path = urlsplit(self.path).path
                with gh.lock:
                    gh.requests.append((method, path, dict(self.headers)))
                    if path == "/redirect":
                        return self.send(302, headers={"Location": "https://evil.example/steal"})
                    if path == "/big":
                        return self.send(200, raw=b"x" * 3000)
                    if self.headers.get("Authorization") != f"Bearer {gh.token}":
                        return self.send(401, {"message": "Bad credentials"})
                    prefix = f"/repos/{gh.owner}/{gh.repo}"
                    if not path.startswith(prefix):
                        return self.send(404, {"message": "Not Found"})
                    rest = path[len(prefix):]
                    return self.route(method, rest, self.body() if method in ("POST", "PATCH", "PUT") else None)

            def route(self, method, rest, body):
                if rest == "" and method == "GET":
                    return self.send(200, {"id": 42, "full_name": f"{gh.owner}/{gh.repo}", "private": gh.private,
                                           "default_branch": gh.branch, "permissions": {"pull": True, "push": gh.push}})
                if rest.startswith("/git/ref/heads/") and method == "GET":
                    b = unquote(rest[len("/git/ref/heads/"):])
                    if not gh.refs:
                        return self.send(409, {"message": "Git Repository is empty."})
                    if b not in gh.refs:
                        return self.send(404, {"message": "Not Found"})
                    etag = f'W/"{gh.refs[b]}"'
                    if self.headers.get("If-None-Match") == etag:
                        return self.send(304)
                    return self.send(200, {"object": {"sha": gh.refs[b], "type": "commit"}}, {"ETag": etag})
                if rest.startswith("/git/commits/") and method == "GET":
                    c = gh.commits.get(rest.split("/")[-1])
                    return self.send(200, {"sha": rest.split("/")[-1], "tree": {"sha": c["tree"]}}) if c else self.send(404)
                if rest.startswith("/git/trees/") and method == "GET":
                    flat = gh.trees.get(rest.split("/")[-1])
                    if flat is None:
                        return self.send(404)
                    entries = [{"path": p, "mode": m, "type": "commit" if m == "160000" else "blob", "sha": s}
                               for p, (m, s) in sorted(flat.items())]
                    return self.send(200, {"tree": entries, "truncated": False})
                if rest.startswith("/git/blobs/") and method == "GET":
                    data = gh.blobs.get(rest.split("/")[-1])
                    if data is None:
                        return self.send(404)
                    return self.send(200, {"content": base64.b64encode(data).decode(), "encoding": "base64"})
                if rest == "/git/blobs" and method == "POST":
                    return self.send(201, {"sha": gh.add_blob(base64.b64decode(body["content"]))})
                if rest == "/git/trees" and method == "POST":
                    flat = dict(gh.trees[body["base_tree"]])
                    for e in body["tree"]:
                        if e["sha"] is None:
                            flat.pop(e["path"], None)
                        else:
                            flat[e["path"]] = (e["mode"], e["sha"])
                    t = gh._id(flat)
                    gh.trees[t] = flat
                    return self.send(201, {"sha": t})
                if rest == "/git/commits" and method == "POST":
                    c = gh._id({**body, "n": len(gh.commits)})
                    gh.commits[c] = {"tree": body["tree"], "parents": body["parents"], "message": body["message"]}
                    return self.send(201, {"sha": c})
                if rest.startswith("/git/refs/heads/") and method == "PATCH":
                    if gh.before_patch:
                        hook, gh.before_patch = gh.before_patch, None
                        hook()
                    b = unquote(rest[len("/git/refs/heads/"):])
                    if gh.commits[body["sha"]]["parents"] != [gh.refs.get(b)]:
                        return self.send(422, {"message": "Update is not a fast forward"})
                    gh.refs[b] = body["sha"]
                    return self.send(200, {"object": {"sha": body["sha"]}})
                if rest.startswith("/contents/") and method == "PUT":
                    path = unquote(rest[len("/contents/"):])
                    gh.branch = body.get("branch", gh.branch)
                    gh.trees.setdefault("empty", {})
                    if not gh.refs:
                        gh.commit_files({path: base64.b64decode(body["content"])}, body["message"])
                    return self.send(201, {"content": {"path": path}})
                return self.send(404, {"message": "Not Found"})

            def do_GET(self):
                self.handle_any("GET")

            def do_POST(self):
                self.handle_any("POST")

            def do_PATCH(self):
                self.handle_any("PATCH")

            def do_PUT(self):
                self.handle_any("PUT")

        return H
