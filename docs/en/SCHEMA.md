# Roadmap format (JSON)

Formal source: [`schema/roadmap.schema.json`](../../schema/roadmap.schema.json). Semantic rules: `python3 tools/roadkit.py check`. This page explains what each field does on screen.

```jsonc
{
  "$schema": "../schema/roadmap.schema.json",   // autocompletion in your editor
  "schemaVersion": 1,
  "id": "my-roadmap",                           // required, slug; key of the saved progress; never change it
  "meta": { ... },
  "theme": { ... },
  "labels": { ... },
  "phases": [ ... ],                            // optional
  "nodes": [ ... ],                             // required
  "projects": [ ... ]                           // optional
}
```

## `meta`

| Field | Where it shows up |
|---|---|
| `title` (required) | page title, browser tab, picker |
| `eyebrow` | small uppercase line above the title |
| `subtitle` | line below the title |
| `description` | one sentence used in listings |
| `icon` | emoji in the empty panel and in the picker |
| `language` | interface text pack: `pt-BR` (default), `en` |
| `brand` | sidebar logo: `{ "plain": "road", "accent": "kit" }` (`accent` uses the `theme.brandAccent` color) |
| `tagline` | text under the logo; `\n` breaks the line |
| `sidebarNote` | note at the bottom of the sidebar; `\n` breaks the line |
| `footer` | page footer |
| `defaultView` | view opened first: `map` (default) or `kanban`. The user's choice is saved per roadmap |
| `startDate` | day the roadmap starts (`YYYY-MM-DD`). With it, phase `period`s and topic `time`s become dates. Users can set their own start in the app, which wins |

## `theme`

`accent` (buttons, "Mark as done") and `brandAccent` (logo highlight), in hex (`#233b65`). Green always means "done".

## `labels`

Overrides any interface text. The keys are in `src/labels/en.json` (and `pt-BR.json`). Useful examples: `challenge` ("Hands-on challenge" to "Deliverable"), `success`, `topics`, `markDone`, `doneHint`, `legendHint`.

## `phases[]` (optional)

Without `phases`, the map is a plain list and the phase navigation goes away.

| Field | Notes |
|---|---|
| `id` (required) | slug, referenced by `nodes[].phase` |
| `title` (required) | banner next to the map and sidebar item |
| `summary` | banner text |
| `period` | "Weeks 1 to 3", "Q1"… (free text) |
| `color` | hex; if omitted, a palette is used |
| `milestone` | milestone shown after the phase's last main topic; turns green when the whole phase is done. |
| `due` | target day for the phase (`YYYY-MM-DD`), shown on the phase flag; wins over the date computed from `period`. `check` warns when a phase is due before the previous one |

The order of the array sets the order of the phases.

## `nodes[]`

| Field | Notes |
|---|---|
| `id` (required) | unique slug; key of the progress |
| `title` (required) | short (≤ 60 characters) |
| `phase` | phase id (required on main topics when there are `phases`; sub-topics inherit their parent's) |
| `time` | free text on the card and in the panel ("Week 2") |
| `summary` | paragraph in the side panel |
| `topics` | list of strings (tags) |
| `challenge` | hands-on task or deliverable (yellow box) |
| `success` | completion criterion |
| `links` | `[{ "title": "…", "url": "https://…" }]` |
| `parent` | id of the topic this one is a sub-topic of (see "Tree" below) |
| `optional` | `true` = side branch, counts neither toward progress nor toward its parent. Requires `parent` |
| `anchor` | old name for `parent`, used only by optional topics. Still works |
| `status` | initial kanban column: `todo`, `working`, `review` or `finished`. If omitted, it comes from the tasks (or `todo`) |
| `tasks` | the topic's task list, shown as a small kanban inside the card (see below) |
| `due` | target day for the topic (`YYYY-MM-DD`); wins over the date computed from `time` |

Every field other than `id` and `title` is optional; empty sections are not shown.

### Order and layout

- Main topics (no `parent` and not optional) go down the center column **in array order**, and must be grouped by phase in phase order.
- Sub-topics and optional topics sit to the right of their parent (several on the same parent stack up) and can be anywhere in the array.
- The layout is computed in the browser from the real height of each card. There are no coordinates in the JSON.

### Tree: sub-topics and optional topics

A topic can have children through `parent`, up to **2 levels** below a main topic (main, child and grandchild):

```jsonc
{ "id": "install", "title": "Install Argo CD", "phase": "base" },
{ "id": "via-helm", "title": "With Helm", "parent": "install" },
{ "id": "values", "title": "Chart values", "parent": "via-helm" },
{ "id": "hooks", "title": "Hooks", "parent": "via-helm", "optional": true }
```

- Children show up in the columns to the right, connected to their parent. On narrow screens they are nested below it.
- A child inherits its parent's phase.
- **Required sub-topics** (no `optional`) drive their parent: the parent is done when all of them (and their `tasks`) are. Marking the parent as done finishes everything below it, and reopening the parent reopens them. Only main topics count toward overall progress.
- **Optional topics** count toward nothing: neither progress nor finishing the parent.
- Cycles and depth beyond 2 are errors in `check`; the interface tolerates them and moves the node up a level.

## Kanban

The interface has two views of the same roadmap: **Map** and **Kanban**. The roadmap kanban has four columns (`todo`, `working`, `review`, `finished`, named by the `labels` `kanbanTodo`, `kanbanWorking`, `kanbanReview`, `kanbanFinished`) and each topic is a card dragged between them. A topic in `finished` counts as done in the progress and on the map.

Any topic can have `tasks`, which become a small kanban in the details panel, with the same four columns:

```jsonc
{
  "id": "setup",
  "title": "Environment and project",
  "tasks": [
    { "id": "install-hub", "title": "Install the Hub and the editor", "status": "finished" },
    { "id": "create-project", "title": "Create the project", "note": "3D template with URP." },
    { "id": "first-commit", "title": "Make the first commit" }
  ]
}
```

| Task field | Notes |
|---|---|
| `id` (required) | slug, unique within the topic |
| `title` (required) | short |
| `note` | supporting line below the title |
| `status` | initial column; the default is `todo` |

When to use them: when the topic has concrete, checkable steps (3 to 8 work well). Topics without `tasks` remain a single card.

How the topic's state and its tasks' states relate:

- Marking the topic as done (with the button, on the card or by dragging it to `finished`) finishes every task. Moving the topic to `todo` resets them all. Taking the topic out of `finished` reopens them all in the target column.
- Moving it to `working` or `review` (without leaving `finished`) changes only the topic.
- Moving a task recalculates the topic: all finished is `finished`; all in `todo` is `todo`; the rest in `review` or `finished` is `review`; any other mix is `working`.
- With no `status` on the topic, the initial state is computed the same way from its tasks.

If a topic moves to `working`, `review` or `finished` while earlier main topics are still not done, its kanban card shows a warning (and so does the details panel). Users decide how much to tolerate in the settings. Optional topics neither trigger nor count toward the warning.

What a user changes in the interface is saved in the browser, per roadmap; the JSON only sets the starting point. The order within columns follows the order in the JSON.

## `projects[]` (optional)

Hands-on projects that span several topics, at three levels. With `projects`, a **Projects** view shows up next to Map and Kanban; without it, nothing changes.

```jsonc
"projects": [
  {
    "id": "task-api",
    "title": "Task API",
    "level": "beginner",
    "summary": "A REST API with task CRUD, stored in a database.",
    "uses": ["http", "sql-basics"],
    "requirements": [
      { "id": "crud", "title": "Create, list, edit and delete tasks" },
      { "id": "tests", "title": "Tests for the main routes" }
    ],
    "deliverable": "A repository with the code and a README on how to run it.",
    "success": "Someone else can run and use the API following only the README.",
    "stretch": ["Pagination", "Token authentication"],
    "time": "1 to 2 weeks",
    "links": [{ "title": "…", "url": "https://…" }]
  }
]
```

| Field | Notes |
|---|---|
| `id` (required) | slug, unique among projects; key of the project's progress |
| `title` (required) | short (≤ 60 characters) |
| `level` (required) | `beginner`, `intermediate` or `advanced`: the column in the Projects view |
| `summary` | one sentence on the card and in the panel |
| `uses` | ids of `nodes` this project practices. When all of them are done, the project is **ready to start** |
| `requirements` | what the project must do, as a checklist; `id` unique within the project |
| `deliverable` | what to hand in (yellow box in the panel) |
| `success` | how to know it is done |
| `stretch` | extra challenges (a list of strings) the user can check off; they do not count toward finishing the project |
| `time` | free text ("1 to 2 weeks") |
| `links` | `[{ "title": "…", "url": "https://…" }]` |

- Projects do not count toward the roadmap's progress bar, which still measures main topics. The Projects view has its own count.
- Each project's progress (state, checked requirements and extra challenges, and the link to your repository) is stored with the rest of the progress, under `state.projects`. Extra challenges are keyed by their text, so rewording one unchecks it.
- `check` reports `uses` pointing to a missing id, an invalid `level` and duplicate ids, and warns when a project has neither `uses` nor `requirements`, or when there are more than 20 projects (or more than 8 in one level).
- The view's labels (`viewProjects`, `level_beginner`, `requirements`, `deliverable`, `stretch`...) can be overridden through `labels`, like any other.
