"""GitHub as a sync destination, through the Git Data API so every sync is one commit.

Only https://api.github.com is ever contacted. The owner, repository, branch and folder are checked against strict
patterns before they go into a URL, and quoted anyway. A fine-grained token with "Contents: read and write" on the one
repository is all it needs.
"""
import base64
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote

from .errors import AuthError, Conflict, NoAccess, RateLimited, SyncError, TooLarge
from .net import SafeClient
from .provider import Provider, Remote, register

GITHUB_API = "https://api.github.com"
NAME = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
BRANCH = re.compile(r"^[A-Za-z0-9._/-]{1,200}$")
FOLDER_PART = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")


def valid_owner_repo(owner, repo):
    return all(isinstance(x, str) and NAME.match(x) and x not in (".", "..") for x in (owner, repo))


def valid_branch(branch):
    """Git's rules for a branch name, the parts that matter here."""
    return (isinstance(branch, str) and bool(BRANCH.match(branch)) and ".." not in branch and "//" not in branch
            and not branch.startswith(("/", ".", "-")) and not branch.endswith(("/", ".", ".lock"))
            and all(not p.startswith(".") for p in branch.split("/")))


def valid_folder(folder):
    """A folder inside the repository, never its root: 1 to 5 parts like 'roadkit' or 'sync/roadkit'."""
    if not isinstance(folder, str):
        return False
    parts = folder.split("/")
    return 1 <= len(parts) <= 5 and all(FOLDER_PART.match(p) for p in parts)


def token_kind(token):
    if token.startswith("github_pat_"):
        return "fine-grained"
    if token.startswith(("ghp_", "gho_", "ghu_")):
        return "classic"
    return "unknown"


def _expiry(header):
    """GitHub's 'github-authentication-token-expiration' header ('2026-12-01 12:00:00 UTC' or with an offset)."""
    if not header:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S %Z", "%Y-%m-%d %H:%M:%S %z"):
        try:
            d = datetime.strptime(header.strip(), fmt)
            return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    return None


@register
class GitHubProvider(Provider):
    name = "github"
    fields = ("owner", "repo", "branch", "folder")

    def __init__(self, token, owner, repo, branch, folder, user_agent="roadkit", client=None):
        if not valid_owner_repo(owner, repo):
            raise ValueError("invalid owner or repository")
        if not valid_branch(branch):
            raise ValueError("invalid branch")
        if not valid_folder(folder):
            raise ValueError("invalid folder")
        if not isinstance(token, str) or not token or len(token) > 255 or any(c.isspace() for c in token):
            raise AuthError("the token is missing or malformed")
        self.owner, self.repo, self.branch, self.folder = owner, repo, branch, folder
        self.client = client or SafeClient(token, GITHUB_API, user_agent=user_agent,
                                           extra_headers={"Accept": "application/vnd.github+json",
                                                          "X-GitHub-Api-Version": "2022-11-28"})
        self.kind = token_kind(token)
        self.expires = None
        self._etag, self._last, self._trees = None, None, {}

    # -- plumbing --
    def _repo_path(self, rest=""):
        return f"/repos/{quote(self.owner, safe='')}/{quote(self.repo, safe='')}{rest}"

    def _ref(self):
        return self._repo_path("/git/ref/heads/" + quote(self.branch, safe="/"))

    def _call(self, method, path, body=None, ok=(200,), headers=None, allow=()):
        r = self.client.request(method, path, body, headers)
        self.expires = _expiry(r.header("github-authentication-token-expiration")) or self.expires
        if r.status in ok or r.status in allow:
            return r
        if r.status == 401:
            raise AuthError("GitHub refused the token (wrong, expired or revoked)")
        if r.status in (403, 429):
            retry = r.header("retry-after")
            if r.header("x-ratelimit-remaining") == "0" or retry:
                try:
                    at = int(retry) + time.time() if retry else int(r.header("x-ratelimit-reset"))
                except (TypeError, ValueError):
                    at = time.time() + 60
                raise RateLimited("GitHub asked to wait (rate limit)", at)
            raise NoAccess("the token cannot do this: it needs 'Contents: read and write' on this repository")
        if r.status == 404:
            raise NoAccess("repository or branch not found, or the token cannot see it")
        raise SyncError(self.client.redact(f"GitHub answered {r.status} to {method} {path.split('?')[0]}"))

    # -- the interface --
    def check(self):
        info = self._call("GET", self._repo_path()).json() or {}
        perms = info.get("permissions") or {}
        if perms and not perms.get("push"):
            raise NoAccess("the token can read but not write: give it 'Contents: read and write'")
        r = self._call("GET", self._ref(), allow=(404, 409))
        empty = r.status == 409
        if r.status == 404:
            raise NoAccess(f"the branch '{self.branch}' does not exist")
        return {"repoId": info.get("id"), "fullName": info.get("full_name"), "private": bool(info.get("private")),
                "defaultBranch": info.get("default_branch"), "empty": empty, "tokenKind": self.kind,
                "tokenExpires": self.expires}

    def read(self):
        headers = {"If-None-Match": self._etag} if self._etag and self._last else None
        r = self._call("GET", self._ref(), headers=headers, allow=(304, 409))
        if r.status == 304:
            return self._last
        if r.status == 409:                              # an empty repository has no branch yet
            self._etag, self._last = None, Remote(None, {})
            return self._last
        head = (r.json() or {}).get("object", {}).get("sha")
        if not isinstance(head, str):
            raise SyncError("GitHub sent an unexpected branch reference")
        tree = self._tree_of(head)
        listing = self._call("GET", self._repo_path(f"/git/trees/{quote(tree)}?recursive=1")).json() or {}
        if listing.get("truncated"):
            raise TooLarge("the repository is too large to list in one go")
        prefix = self.folder + "/"
        files = {}
        for e in listing.get("tree", []):
            path = e.get("path")
            if (isinstance(path, str) and path.startswith(prefix) and e.get("type") == "blob"
                    and e.get("mode") == "100644" and isinstance(e.get("sha"), str)):
                files[path[len(prefix):]] = e["sha"]
        self._etag, self._last = r.header("ETag"), Remote(head, files)
        return self._last

    def _tree_of(self, commit):
        if commit not in self._trees:
            c = self._call("GET", self._repo_path(f"/git/commits/{quote(commit)}")).json() or {}
            sha = (c.get("tree") or {}).get("sha")
            if not isinstance(sha, str):
                raise SyncError("GitHub sent an unexpected commit")
            self._trees = {commit: sha}
        return self._trees[commit]

    def fetch(self, path, sha):
        blob = self._call("GET", self._repo_path(f"/git/blobs/{quote(sha)}")).json() or {}
        if blob.get("encoding") != "base64" or not isinstance(blob.get("content"), str):
            raise SyncError(f"GitHub sent {path} in an unexpected encoding")
        return base64.b64decode(blob["content"])

    def write(self, rev, changes, message):
        if rev is None:                                  # empty repository: the Contents API makes the first commit
            first = next(p for p, d in sorted(changes.items()) if d is not None)
            self._call("PUT", self._repo_path("/contents/" + quote(f"{self.folder}/{first}", safe="/")),
                       {"message": message, "branch": self.branch,
                        "content": base64.b64encode(changes[first]).decode("ascii")}, ok=(200, 201))
            self._etag = None
            rev = self.read().rev
            if rev is None:
                raise SyncError("GitHub did not create the first commit")
            if self._last.files.get(first):
                changes = {p: d for p, d in changes.items() if p != first}
                if not changes:
                    return rev
        entries = []
        for p, data in sorted(changes.items()):
            if data is None:
                entries.append({"path": f"{self.folder}/{p}", "mode": "100644", "type": "blob", "sha": None})
                continue
            blob = self._call("POST", self._repo_path("/git/blobs"),
                              {"content": base64.b64encode(data).decode("ascii"), "encoding": "base64"},
                              ok=(201,)).json()
            entries.append({"path": f"{self.folder}/{p}", "mode": "100644", "type": "blob", "sha": blob["sha"]})
        tree = self._call("POST", self._repo_path("/git/trees"),
                          {"base_tree": self._tree_of(rev), "tree": entries}, ok=(201,)).json()
        commit = self._call("POST", self._repo_path("/git/commits"),
                            {"message": message, "tree": tree["sha"], "parents": [rev]}, ok=(201,)).json()
        r = self._call("PATCH", self._repo_path("/git/refs/heads/" + quote(self.branch, safe="/")),
                       {"sha": commit["sha"], "force": False}, allow=(409, 422))
        if r.status in (409, 422):
            self._etag = None
            raise Conflict("the branch moved during the sync")
        self._etag = None
        return commit["sha"]
