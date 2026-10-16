# Releasing versions

Each Roadkit version becomes a GitHub release built from a tag. You push the tag and the automation does the rest: it creates the release with its notes, attaches a zip of the code and publishes the Docker image.

## Which number to pick

The project follows [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **Patch** (`1.0.1`): fixes something without changing what exists.
- **Minor** (`1.1.0`): adds something that breaks nothing. A new optional JSON field, a new button, a new endpoint.
- **Major** (`2.0.0`): breaks something that used to work. A JSON field whose meaning changes, an endpoint that goes away, a valid roadmap that stops being valid.

What counts as "the contract" is the roadmap JSON format (see [`SCHEMA.md`](SCHEMA.md)) and the server API (in [How it works](how-it-works.md#the-api)). Changing the look or the internals does not bump the major version.

## The path of a release

Release notes write themselves: the workflow collects the commits since the previous release, groups them by type and builds the text. You do not need to change any file to publish. So the shortest path is:

1. Wait for CI on `main` to go green.
2. In *Actions → Release → Run workflow*, type the version without the `v` (for example `1.1.0`) and confirm. The workflow creates the `v1.1.0` tag itself and publishes everything.

If you prefer the command line, create and push the tag; the result is the same:

```bash
git tag -a v1.1.0 -m "Roadkit 1.1.0"
git push origin v1.1.0
```

Within a minute or two the release shows up under *Releases*, and the Docker image a few minutes later, because it is built for two architectures. A version with a suffix, like `1.2.0-rc.1`, becomes a *pre-release* and does not get the `latest` Docker tag.

### Where the notes come from

The release text has up to three parts, in this order:

1. **Highlights you wrote** (optional): if [`CHANGELOG.md`](../../CHANGELOG.md) has a `## [1.1.0] - date` section, it goes on top. It is the place to tell what matters in plain language, and it is what 1.0.0 used.
2. **What changed** (automatic): every commit between the previous release and this one, in groups: New features, Fixes, Performance, Documentation, Dependencies, Maintenance and Other changes. Maintenance and Dependencies come collapsed. Each line links to its commit, or to the pull request when the title ends with `(#12)`, and at the end there is a link comparing the two versions. The first release skips this part, because it would list the whole project.
3. **How to install**: the zip, the checksum and the `docker pull` command for the version.

The notes themselves are written in Portuguese, the project's main language.

Grouping reads the start of the commit title (or the PR title, which becomes the commit when you *squash*). You can help by writing in the [Conventional Commits](https://www.conventionalcommits.org/) style: `feat: export button`, `fix: error importing a zip`, `docs: explain categories`, `chore: update CI`. A `feat(deps):` or Dependabot lands in Dependencies, and a `!` after the type (`feat!: ...`) marks a breaking change. Without a prefix it still works: titles starting with "Add", "Fix" and similar are recognized, and the rest goes to "Other changes".

You can preview the notes before publishing:

```bash
python3 .github/scripts/release_notes.py v1.1.0 nycholasmarques/roadkit
```

(It needs a local `v1.1.0` tag to compare against. For a test, create the tag, run it and delete it.)

## CI

[`ci.yml`](../../.github/workflows/ci.yml) runs on every push to `main` and on every pull request, and checks what most often breaks without anyone noticing:

- the roadmaps and examples pass `check`, and the repository's `manifest.json` is up to date (if it is not, the error tells you to run `python3 tools/roadkit.py index`);
- the interface texts have the same keys in every language, and every key used in `index.html` exists;
- the JavaScript and the Python are syntactically valid;
- the server starts, lists roadmaps, validates, creates, reads, saves progress and deletes, and refuses writes from another origin;
- the Docker image builds and answers.

The main job is called `check` and the Docker one `docker`. Those two names are what the protection on `main` requires, so if you rename one, update the rule in the settings.

Dependabot ([`dependabot.yml`](../../.github/dependabot.yml)) opens one grouped pull request a month for the actions, and one for the Python base image of the Dockerfile.

## Protecting main

Protection rules live in the repository settings, not in the code, so there is no file to commit. What I use, under *Settings → Rules → Rulesets*, for `main`:

- block deletion and history rewrites (*Restrict deletions* and *Block force pushes*);
- require a pull request before merging (*Require a pull request before merging*), without requiring approval, since a one-person project would have nobody to approve;
- require CI to pass (*Require status checks to pass*), with the `check` and `docker` jobs.

For `v*` tags, a ruleset that prevents deleting or moving them (*Restrict deletions* and *Restrict updates*) keeps a published version from ever changing by accident.

One practical effect: with this on, nothing goes straight into `main`. The flow becomes branch, pull request, green CI and merge. Admins can bypass the rule if you add them to the bypass list.
