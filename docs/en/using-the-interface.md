# Using the interface

<p align="center">
  <img src="../media/visao-geral.gif" alt="Finishing a topic, moving a card on the kanban, switching to the dark theme and opening the Today screen" width="100%">
</p>

## What is on the screen

On the left is the sidebar: the logo, the **Today** button, the roadmap picker, the phases of the open roadmap and the tools (new roadmap, statistics, notes, export, import, reset, open file). At the top of the content are the title, the progress bar (with a small chart that opens that roadmap statistics), the roadmap search, the **Next topic** and **Start** buttons, the **Map / Kanban / Projects** switch, the global search, the panel button and the settings. On the right is the details panel for the selected topic.

Both sidebars can be dragged by their edge to make them wider or narrower, and a double click brings them back to the default size. The left one collapses into a strip of icons with the `‹` button next to the logo. The right one, on wide screens, folds away with the panel button next to the settings: the map gets the room, and a topic you pick opens on top, as on a smaller screen. With both folded, only the roadmap is left in the middle. Whatever you choose is saved in the browser.

## Where to go next

The bigger features have a guide of their own, with GIFs:

| Guide | What it covers |
|---|---|
| [Day to day: Today, review and focus](daily-use.md) | The screen that gathers every roadmap, spaced review and the focus timer |
| [Projects](projects.md) | Hands-on projects by level, in the interface and in the JSON |
| [Notes, export and share](notes-and-export.md) | Markdown notes, the .zip, Markdown, the page to share and dates |
| [Statistics](statistics.md) | Heatmap, streak, pace and forecast, and where the numbers come from |

## The map

<p align="center">
  <img src="../media/mapa-claro.png" alt="The Argo CD roadmap on the map, with a topic panel open" width="88%">
</p>

The map draws the main topics in order, top to bottom, grouped by phase. Sub-topics and optional explorations sit to the right of their topic, connected by a line. When a topic and the next one are both done, the line between them turns green.

Click a topic to open the details panel: the summary, what to study, the hands-on challenge, the criterion for calling it done, the tasks and the links. The small square in the corner of the card marks it as done without opening anything.

**Next topic** jumps to the first topic that is not done yet. **Start** does the same and is the highlighted one, because it is what you want the first time.

## The kanban

The **Kanban** button swaps the map for a board with four columns: to do, working, review and finished. Each topic is a card. Drag it from one column to another with the mouse, or use the arrows on the card (handy with a keyboard and on a phone).

<p align="center">
  <img src="../media/kanban.png" alt="The kanban board with the topics of the Argo CD roadmap" width="88%">
</p>

A topic's state is the same in both views. Moving a card on the kanban changes its color on the map, and the other way around.

## How progress is counted

Only main topics count toward the progress bar at the top. The other levels have their own rules:

- **Tasks.** A topic can have a task list, shown as a small kanban in the details panel. The topic follows its tasks: when all of them are finished, so is the topic. Marking the topic as done finishes every task at once, and reopening the topic reopens them all.
- **Sub-topics.** They work the same way, with topics in place of tasks. A topic with required sub-topics is only done when all of them are. Sub-topics do not count on their own in the progress bar; their main topic does.
- **Optional topics.** They sit to the side with a dashed border and count toward nothing. They are there to explore if you feel like it, without blocking anything.

## The skipped topic warning

If you move a topic forward on the kanban without finishing the ones before it, the card gets a warning icon. Clicking it shows, inside the card, what was left behind. It blocks nothing; it is only a reminder. In **Settings** you choose the tolerance: always warn, allow up to 3 or 5 pending topics, or never warn.

## Switching roadmaps

The picker in the sidebar shows each roadmap with its own progress bar, and a green badge when it is complete. Roadmaps are grouped in sections, which are the folders the files live in (see [Creating roadmaps](creating-roadmaps.md#categories)).

At the bottom of the picker is **Manage roadmaps**, the full list. From there you can open, duplicate and hide any roadmap, and edit or delete the ones created in the interface. Roadmaps that come from files in the `roadmaps/` folder cannot be deleted from here, because the server never touches your files: hiding removes them from the list without deleting anything, and you can restore them later.

## Search and keyboard shortcuts

<p align="center">
  <img src="../media/busca.gif" alt="Searching "kstmz" and finding Kustomize, opening the Today screen and the shortcut list" width="100%">
</p>

`Ctrl+K` (`⌘K` on a Mac), or the magnifier at the top, opens a search that goes anywhere: topics and projects of **every** roadmap, the roadmaps themselves and the actions (new roadmap, export, notes, switch view, toggle mode, settings). It ignores accents and case and accepts skipped letters, like "kstmz" for Kustomize. Results from the open roadmap come first, each topic with its roadmap, phase and state. `↑` `↓` pick, `Enter` opens and `Esc` closes. With an empty box, the items you opened last show up.

Outside text fields, a few single-letter keys work right away:

| Key | What it does |
|---|---|
| `/` | jumps to the search box |
| `M` · `K` · `P` | Map, Kanban, Projects |
| `H` | opens or closes the Today screen |
| `N` | next topic to do |
| `J` · `L` | previous / next topic, in path order |
| `1` · `2` · `3` · `4` | to do, working, review, finished, on the open topic or project |
| `T` | toggles light and dark mode |
| `?` | shows the list of shortcuts |

On a computer, buttons that have a shortcut show its key next to them (`H` on Today, `N` on Next topic, `M` `K` `P` on the views, `Ctrl K` on the magnifier), so you pick them up as you go. **Settings → Keyboard shortcuts** turns the single-letter keys off (for screen reader users or extensions that already use those keys); `Ctrl+K` and `Esc` keep working. On a phone, search opens from the magnifier and takes the whole screen.

## Settings and themes

The button in the top right corner opens the settings: mode (light, dark or auto), theme, text size, interface language, what to open first (the last roadmap or the Today screen), spaced review, focus sessions and the skipped topic tolerance. With the language on "Automatic", it follows the `meta.language` of the open roadmap. Picking a fixed language applies to every roadmap.

The mode says whether the screen is light or dark, and the theme picks the colors for each. There are three light themes and four dark ones:

<p align="center">
  <img src="../media/temas.png" alt="The same roadmap in the seven themes" width="100%">
</p>

| Theme | Mode | What it is for |
|---|---|---|
| Light | light | the default, white with a hint of blue |
| Mist | light | soft gray: less glare on large monitors |
| Paper | light | warm sepia, easy on the eyes for long reading |
| Night | dark | the default, dark with a blue tint |
| Graphite | dark | neutral dark, no blue tint |
| Plum | dark | dark with a touch of violet |
| Black | dark | true black, for OLED screens and dark rooms |

In auto mode both rows show up: you pick one theme for when the system is light and another for when it is dark. In every theme green still means "done" and amber "review", and the roadmap's own colors (`theme.accent`) still apply. Your choice is saved in the browser.

The last line of the settings shows where progress is being saved: on the server or only in this browser.

## Install it and use it offline

Roadkit is an installable app (PWA). In Chrome and Edge the install icon shows up in the address bar, and **Settings → Install as an app** does the same. Once installed, it opens in its own window, with an icon, and can sit in the taskbar or on your phone's home screen. On an iPhone, use **Share → Add to Home Screen**.

After opening it once, Roadkit **opens with no internet**: the interface is kept in the browser, along with a copy of every roadmap in the list, even the ones you never opened on that device. Offline, you keep checking off progress and writing notes; the settings line says it is saving on this device only, and everything goes up to the server when the connection returns.

When a new Roadkit version comes out, a quiet strip at the bottom says **A new version is available · Reload**. It never reloads by itself, so it never interrupts what you are typing.

This works on `http://localhost` and on any HTTPS address. To use it from another device on your network, see [Docker and network](docker-and-network.md#installable-app-and-https).

To try it without installing anything, there is a [demo](https://nycholasmarques.github.io/roadkit/app/) on the Roadkit website: the same app, with the example roadmaps, and progress kept in the browser only. Creating and editing roadmaps, statistics and syncing across devices need the server; a notice in the sidebar says so and can be hidden for 30 days.

## On a phone

<p align="center">
  <img src="../media/celular.png" alt="The map, the Today screen, projects and statistics on a phone" width="100%">
</p>

On narrow screens the map becomes a single-column timeline with the phases as shortcuts at the top, and the details panel opens on top like a drawer. While you drag a card, the kanban shows a fixed strip with the four columns, so you can drop the card without scrolling the page.
