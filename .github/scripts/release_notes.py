#!/usr/bin/env python3
"""Builds the body of a GitHub release (Markdown, stdlib only).

    release_notes.py <tag> <owner/repo> [--prev <ref>]

The body has three parts:
  1. The matching section of CHANGELOG.md, if you wrote one (the curated highlights).
  2. "O que mudou": every commit since the previous release tag, grouped by what it
     says it is. Conventional prefixes win (feat:, fix:, docs:...). Without a prefix,
     the first word decides (Add..., Fix...). Everything else is "Outras mudanças".
     Skipped for the first release, which would just list the whole history.
  3. How to get it: the zip, the checksum and the Docker image.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

GROUPS = [
    ("feat", "Novidades"),
    ("fix", "Correções"),
    ("perf", "Desempenho"),
    ("docs", "Documentação"),
    ("deps", "Dependências"),
    ("maint", "Manutenção"),
    ("other", "Outras mudanças"),
]
PREFIX = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?:\s*(?P<rest>.+)$", re.I)
TYPE_TO_GROUP = {
    "feat": "feat", "feature": "feat",
    "fix": "fix", "bugfix": "fix", "hotfix": "fix",
    "perf": "perf",
    "docs": "docs", "doc": "docs",
    "refactor": "maint", "style": "maint", "test": "maint", "tests": "maint",
    "build": "maint", "ci": "maint", "chore": "maint",
}
VERB_TO_GROUP = {
    "add": "feat", "introduce": "feat", "support": "feat", "allow": "feat", "create": "feat", "show": "feat", "enable": "feat", "let": "feat",
    "fix": "fix", "correct": "fix", "repair": "fix",
    "bump": "deps",
    "update": "maint", "rewrite": "maint", "replace": "maint", "move": "maint", "keep": "maint", "remove": "maint", "rename": "maint", "refactor": "maint", "clean": "maint",
}


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def semver_key(tag):
    m = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)(?:-(.+))?", tag)
    if not m:
        return None
    major, minor, patch, pre = m.groups()
    return (int(major), int(minor), int(patch), pre is None, pre or "")


def previous_tag(tag):
    """The release before this one. A final release skips pre-releases, a pre-release does not."""
    me = semver_key(tag)
    final = me[3]
    found = []
    for t in git("tag", "--list", "v*").split():
        k = semver_key(t)
        if k and k < me and (k[3] or not final):
            found.append((k, t))
    return max(found)[1] if found else None


def changelog_section(version):
    path = Path("CHANGELOG.md")
    if not path.exists():
        return ""
    m = re.search(r"^## \[" + re.escape(version) + r"\][^\n]*\n(.*?)(?=^## \[|^\[[^\]]+\]: |\Z)", path.read_text("utf-8"), re.S | re.M)
    return m.group(1).strip() if m else ""


def classify(subject, author):
    if "dependabot" in author.lower():
        return "deps", re.sub(r"^bump\b", "Atualiza", subject, flags=re.I)
    m = PREFIX.match(subject)
    if m and m["type"].lower() in TYPE_TO_GROUP:
        group = TYPE_TO_GROUP[m["type"].lower()]
        if (m["scope"] or "").lower() in ("deps", "dependencies"):
            group = "deps"
        text = m["rest"][0].upper() + m["rest"][1:]
        return group, ("**Quebra compatibilidade:** " + text) if m["bang"] else text
    first = subject.split(" ", 1)[0].lower()
    return VERB_TO_GROUP.get(first, "other"), subject


def commits_since(prev, tag, repo):
    rng = f"{prev}..{tag}"
    out = git("log", "--no-merges", "--format=%H%x1f%s%x1f%an", rng)
    groups = {key: [] for key, _ in GROUPS}
    for line in out.splitlines():
        sha, subject, author = line.split("\x1f")
        group, text = classify(subject, author)
        pr = re.search(r"\(#(\d+)\)\s*$", text)
        if pr:
            text = text[: pr.start()].rstrip()
            ref = f"[#{pr.group(1)}](https://github.com/{repo}/pull/{pr.group(1)})"
        else:
            ref = f"[`{sha[:7]}`](https://github.com/{repo}/commit/{sha})"
        groups[group].append(f"- {text} ({ref})")
    return groups


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tag")
    ap.add_argument("repo")
    ap.add_argument("--prev")
    a = ap.parse_args()
    version = a.tag.lstrip("v")
    owner, name = a.repo.split("/")
    prev = a.prev or previous_tag(a.tag)

    parts = []
    curated = changelog_section(version)
    if curated:
        parts.append(curated)

    if prev:
        groups = commits_since(prev, a.tag, a.repo)
        body = []
        for key, title in GROUPS:
            if not groups[key]:
                continue
            if key in ("maint", "deps"):
                body.append(f"<details>\n<summary><b>{title}</b> ({len(groups[key])})</summary>\n\n" + "\n".join(groups[key]) + "\n\n</details>")
            else:
                body.append(f"### {title}\n\n" + "\n".join(groups[key]))
        if body:
            parts.append("## O que mudou\n\n" + "\n\n".join(body))
        parts.append(f"**Todas as mudanças:** [{prev}...{a.tag}](https://github.com/{a.repo}/compare/{prev}...{a.tag})")

    image = f"ghcr.io/{a.repo.lower()}"
    if "-" in version:
        tags = f"`docker pull {image}:{version}`"
    else:
        major, minor = version.split(".")[:2]
        tags = f"`docker pull {image}:{version}` (também existem `:{major}.{minor}`, `:{major}` e `:latest`)"
    parts.append(
        "## Como instalar\n\n"
        f"- **Código:** baixe o `roadkit-{version}.zip` abaixo, descompacte e rode `python3 tools/roadkit.py serve`. O `SHA256SUMS` confere o arquivo.\n"
        f"- **Docker:** {tags}.\n"
        "- Como atualizar, o que fica no volume e o que muda entre versões: [documentação](https://github.com/" + a.repo + "/blob/" + a.tag + "/docs/docker-e-rede.md)."
    )
    sys.stdout.write("\n\n".join(parts).strip() + "\n")


if __name__ == "__main__":
    main()
