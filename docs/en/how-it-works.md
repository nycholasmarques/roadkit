# How it works

Roadkit has two clearly separate parts: a page that does almost everything in the browser, and a Python server that is small on purpose. Knowing where each thing lives helps you predict what will happen when you change something.

## The big picture

The page knows nothing about learning Rust or running a half marathon. It opens a JSON file, reads what it says (title, phases, topics, colors, language) and draws it. Swapping the JSON swaps the whole roadmap, without touching the code. That is the whole point.

The server (`tools/roadkit.py`) does four things:

1. Serves the interface files.
2. Builds the list of available roadmaps, `manifest.json`, by looking at the folders.
3. Stores each roadmap's progress.
4. Stores the roadmaps created in the interface, and validates roadmaps (the same `check` as the command line).

It only uses the Python standard library. There is no database, no build step and no dependency to install.

## What happens when you open a roadmap

1. The browser requests `manifest.json`. The server walks `roadmaps/` (and the data folder), reads the title, icon, topic count and a few other things from each JSON, and answers with the list, already organized into sections by folder. Each roadmap also carries a light index of its topics and projects (id, title and phase or level), which is what the `Ctrl+K` search uses to find things across every roadmap without downloading each JSON.
2. You pick a roadmap (or the URL carries `?r=<id>`) and the browser downloads that JSON.
3. The JSON goes through a lenient reader (`normalize`, in `src/app.js`): duplicate ids are ignored, unknown phases fall back to the first one, parent cycles are cut. The idea is to open even an imperfect file and report what looked odd in the console. Strictness is `check`'s job.
4. Something else happens in parallel: the browser asks the server for that roadmap's saved progress and applies it.
5. The map is drawn.

## The layout is not in the JSON

The JSON has no coordinates. Main topics go down the middle column in order, grouped by phase. Each topic's children take the columns to the right, one per level. Each card's position is computed in the browser from the real height its text takes. That is why changing the font size rearranges the map, and a roadmap with long titles simply gets taller.

On wide screens the map is drawn in a fixed space and scaled to fit. On narrow screens (under 860 px of usable width) the layout switches to a single-column timeline, with children indented under their parent.

## Where progress is stored

Progress is a small object: the state of each topic and each task (`todo`, `working`, `review` or `finished`) and, when the roadmap has projects, each project's state with its checked requirements and the link to your repository. It lives in two places at once.

**On the server**, in one file per roadmap: `data/<id>.json`. It is the source of truth, which is why progress follows you to any device that opens the same instance.

**In the browser**, in `localStorage`, as a cache. Every change you make is written there immediately, and the interface responds without waiting for the network. Half a second later, the browser sends it to the server.

When the page opens, or when you come back to the tab, the browser asks the server for the latest version. Each version carries the time of its last change, and the newest one wins. That covers the common case (you checked something off on the laptop, then opened your phone), but it is simple on purpose: if two people change the same roadmap at the same time, the last one to save wins, with no topic-by-topic merge. For personal use that is enough.

If the server goes down, nothing is lost: the browser keeps working from the cache and syncs when the server is back. The last line of the settings shows which state it is in. If you had progress saved in the browser before the server existed, it is uploaded the first time. If that older progress ends up replaced by a version from the server (from another device, say), a copy of it is kept in the browser.

## File roadmaps and interface roadmaps

Both end up as JSON, but they live in different places:

| | Files | Created in the interface |
|---|---|---|
| Where | `roadmaps/` (and `examples/`) | `data/roadmaps/` |
| Who writes them | you, in a text editor | the server, when you save in the editor |
| With Docker | mounted read-only | in the data volume |
| Edit and delete from the interface | no (hide only) | yes |

This split is what allows `roadmaps/` to be mounted read-only in Docker: the server never writes to your folder. Both sources are merged in the list, and a category (folder) can hold roadmaps from both.

A roadmap's section is decided by its folder. In the editor, the Category field picks the subfolder of `data/roadmaps/`. For a new category, the server creates the folder and stores the name you typed in a `_section.json`.

Hidden roadmaps are just a list of ids in `data/_hidden.json`. Hiding neither deletes nor touches the file.

## Where notes are stored

Notes live outside the progress file, in `data/notes/<id>.json`, because the progress is rewritten on every click and a large text would make each write heavy. The file has the time of its last change and a map of notes: `roadmap` for the general note, `node:<id>` for a topic and `project:<id>` for a project. Syncing works like the progress: the browser keeps a copy, the newest version wins, and nothing is lost if the server goes down.

Note text never becomes HTML: the renderer in `src/markdown.js` escapes everything before formatting and only accepts `http(s)` links. It has its own tests (`node tools/markdown.test.cjs`), which run in CI.

Nothing inside `data/` is served as a plain file: only through the API, which requires the token when one is set.

## The API

Everything the interface asks of the server is below. It can be useful for scripts, and it is what the Claude Code skill uses when it needs to write to the volume.

| Method and path | What it does |
|---|---|
| `GET /manifest.json` | the list of roadmaps, with sections, counts and hidden ones |
| `GET /api/state/<id>` | a roadmap's saved progress (`204` if there is none) |
| `PUT /api/state/<id>` | saves progress, or returns `409` with what the server has if that is newer. Parts of the progress the client does not send stay as they were, so an older version that only knows topics and tasks does not erase the projects |
| `GET /api/states` | a summary of all of them, for the progress badges |
| `GET /api/notes/<id>` | a roadmap's notes (`204` if there are none) |
| `PUT /api/notes/<id>` | saves the notes, with the same rule as the progress (`409` if the server has a newer copy). Each note holds up to 20,000 characters |
| `POST /api/validate` | validates a roadmap JSON without saving it |
| `POST /api/roadmaps?category=` | creates a roadmap (`categoryTitle=` names a new category) |
| `PUT /api/roadmaps/<id>?category=` | replaces a roadmap created in the interface, and moves it if the category changes |
| `DELETE /api/roadmaps/<id>?progress=1` | deletes it, and optionally erases its progress too |
| `PUT /api/hidden/<id>` | hides or restores it, with `{"hidden": true}` |
| `GET /user/<category>/<id>.json` | the JSON of a roadmap created in the interface |

With `ROADKIT_TOKEN` set, everything under `/api/` requires `Authorization: Bearer <token>`. Writes only accept same-origin requests with `Content-Type: application/json`, which stops a page on another site from writing to your progress.

## How the code is organized

```
index.html          the shell: no roadmap content, only structure
src/app.js          reads the JSON, computes the layout, draws, syncs and edits
src/style.css       the look, light and dark
src/labels/         the interface texts, one file per language
src/ai-prompt.txt   the prompt template for the "Create with AI" button
tools/roadkit.py    the server and the check and index commands
schema/             the JSON Schema, for autocompletion in your editor
examples/           example roadmaps in English and Portuguese
roadmaps/           your roadmaps (empty in the repository)
data/               progress and interface roadmaps (created on first use)
docs/               these pages and the images
.agents/skills/     the skill for coding agents
```

`app.js` is a single file on purpose: no bundler, no modules, no build step. You can open it and read it top to bottom, in the order things happen.

To add an interface language, copy `src/labels/en.json`, translate it and save it with the language code (for example `es.json`). It shows up in the language options on its own.

## The images in the docs

The GIFs and screenshots in `docs/media/` are generated by a script that opens the interface in a real browser, clicks around and records it. That way they do not go stale when something changes visually. It needs Playwright and ffmpeg:

```bash
npm i playwright
ROADKIT_DATA=$(mktemp -d) python3 tools/roadkit.py serve --port 8791 &
node tools/demos/record.cjs http://127.0.0.1:8791            # all of them
node tools/demos/record.cjs http://127.0.0.1:8791 criar      # just one (hero, criar, ia, fotos)
```

Run it against a throwaway server like the one above, not against yours: the script checks off progress and creates test roadmaps.
