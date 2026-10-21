# Changelog

Every notable change lives here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [semantic versioning](https://semver.org/).

Each GitHub release also lists the commits since the previous version on its own; this file is where the hand-written highlights go. To publish a version, see [`docs/en/releasing.md`](docs/en/releasing.md).

## [1.13.0] - Unreleased

### Fixes
- The settings no longer run past the bottom of short windows (an installed app on a laptop, for example): they fit the window and scroll, so every option can be reached.

### Interface
- Finishing a topic with sub-topics (or moving it back to "to do" or out of "finished") changes them too, so Roadkit now asks first, saying how many sub-topics and tasks will change. Cancelling changes nothing, and a card dragged on the kanban goes back to its column. "Don't ask again" turns the dialog off, and a new setting turns it back on.

## [1.12.0] - 2026-10-17

### Documentation
- Every GIF and screenshot now exists in English too, recorded with the English interface and the English example roadmaps, in `docs/media/en/`. The README, the English docs and the English website use them; the Portuguese README and docs keep the Portuguese set. The website swaps the screenshots when you switch PT/EN.
- `tools/demos/record.cjs` takes `RECORD_LANG=en` to record the English set; the roadmaps, ids and text it uses live in one table per language.

## [1.11.0] - 2026-10-17

### Interface
- The details panel stays closed until you pick a topic or project (or press **Next topic**), and closes with its own button in the corner or `Esc`. On wide screens it is a column next to the map only while it is open, so the map gets the whole width the rest of the time. With the left sidebar folded too, only the roadmap is left in the middle.
- The top bar only goes to a single row when the workspace really has the room (from 1800 px with the panel closed, 2140 px with it open), so the title no longer gets squeezed and the settings button never falls off the edge.
- The line that shows while you resize the details panel no longer paints over the top bar.
- Topic cards on the map in the light themes (Light, Mist, Paper) have a soft border and shadow instead of a dark outline.
- In the demo, the notice about progress staying in the browser became a card in the sidebar (the page footer on phones) instead of a bar over the app. It can be hidden for 30 days, and it also says what needs the server. Statistics explain why they are empty there.

### Documentation
- New guides, in Portuguese and English: **Day to day** (Today, spaced review and focus), **Projects** (in the interface and in the JSON), **Notes, export and share** and **Statistics**. The interface tour got shorter and links to them.
- Every GIF and screenshot was redone from the current interface, plus new ones: Today, projects, notes, search, statistics (light and dark), focus, the seven themes (each on a different screen) and phone screens. They mix themes and layouts (details panel open, sidebar folded), and the README and the website show them.
- The website has a new **A look around** section with the real screens.
- `tools/demos/record.cjs` now builds the same believable state before each scene (progress, a project under way, notes, reviews due and months of activity), records with Chromium's own screencast and lets ffmpeg build lighter GIFs: all of them together weigh less than one of the old ones.

## [1.10.0] - 2026-10-17

### Website and live demo
- Roadkit has a website on GitHub Pages, at https://nycholasmarques.github.io/roadkit/. It is one page in English and Portuguese (it follows the browser, with a PT/EN switch), light or dark, with what Roadkit does, why it is different, how to install it and the example roadmaps. No scripts or fonts from elsewhere, and no analytics.
- A **live demo** at https://nycholasmarques.github.io/roadkit/app/ runs the real app with the examples and no server behind it. Progress stays in your browser, and a bar says so and links to installing. It also installs as an app and opens offline.
- `tools/build_site.py` builds both, and the `pages.yml` workflow publishes them at the end of every release, so the site always matches the released version.

### Releases
- When the release workflow cannot create the tag (GitHub refuses it if the release changed a workflow file), it now says how to push the tag yourself.

## [1.9.0] - 2026-10-17

### Statistics
- A **Statistics** screen, in the sidebar tools, the search, or the small chart next to the progress bar. It has your day streak (and the best one of the year), topics finished in the last 30 days and in total, and focus time.
- A **heatmap** of the last 12 months across every roadmap, with each day's numbers on hover or tap.
- **By roadmap**: progress, topics finished per week over 12 weeks, a **forecast** of when it ends at the pace of the last 4 weeks (after two weeks of activity), and the topics finished last with how long they took, next to the topic's estimate when that is a duration.

### Activity
- Changes made offline now land on the day they happened: the browser keeps when each topic moved and sends it with the progress (`events`), and the server uses those times when they are plausible.
- `GET /api/activity` also returns, per roadmap, its days in the period, all-time totals and first day.

## [1.8.0] - 2026-10-17

### Spaced review (off by default)
- With **Settings → Spaced review** on, each main topic you finish comes back for review on the Today screen after 3 days. **I still remember** pushes the next review to 7, 21, 60 and 150 days, then the topic leaves the queue. **I need to review** starts over, moves the topic back to "in review" and opens it.
- The Today button shows how many reviews are due, the topic panel shows the next one, and **Review this roadmap** leaves a roadmap out. Topics already finished when you turn it on stay out of the queue.
- The queue lives on the server in `data/review.json` (`GET`/`PUT /api/review`), synced like the notes.

### Focus sessions (off by default)
- With **Settings → Focus sessions** on, topics and projects get a **Focus** button: a 25-minute, 50-minute or open-ended timer in the corner of the screen, with pause and stop, the time left in the tab title, a short sound at the end and an optional browser notification.
- Sessions of 5 minutes or more are recorded on the topic's activity (`POST /api/activity/<id>/focus`), and the panel shows the total focus time. The timer survives a reload, and sessions made offline wait in a queue.

## [1.7.0] - 2026-10-17

### Today screen
- A **Today** screen, at the top of the sidebar (or the `H` key), gathers every roadmap. **Continue** lists the topics and projects in progress or in review, the one you touched last first. **Up next** shows the next topic of each roadmap used in the last 30 days, with progress and due date.
- **Settings → On open** makes Roadkit open straight on the Today screen. It is also in the search (`Ctrl+K`) and in the shortcut list.
- Clicking a phase of the journey leaves the Today screen and goes to that phase.

### Shortcuts in sight
- On a computer, buttons with a shortcut show the key next to them: `H` on Today, `N` on Next topic, `M` `K` `P` on the views, `Ctrl K` (or `⌘K`) on the search and `Esc` on the Today screen's back button. They go away when single-letter shortcuts are off, and on phones.

### Activity
- The server now records when each topic started, was finished and was last touched, and how much you did each day, in `data/activity/<id>.json`. The file has a bounded size: two years of daily totals, with older days folded into monthly totals. The server writes it from the progress changes, on the time zone of whoever made the change.
- New routes: `GET /api/activity` and `GET /api/activity/<id>`. `GET /api/states` also returns tasks, projects and dates. Deleting a roadmap along with its progress removes its activity too.

## [1.6.0] - 2026-10-17

### Installable and offline
- Roadkit is now an installable app (PWA): its own icon, a window without the browser bar, and **Settings → Install as an app**.
- Once opened, it **works with no internet**, with the interface and a copy of every roadmap in the list, even the ones you never opened on that device. Progress and notes made offline go up when the connection returns.
- When a new version is out, a bar offers **Reload**; the app never reloads on its own.
- The API is never served from cache, and the exported page to share is still a single file, with no service worker.

### Under the hood
- `src/sw.js` (no libraries), served at `/sw.js` with a version computed from the interface files; `src/manifest.webmanifest`.

### Icon
- Roadkit got an icon: a road winding up to a green goal with a check, past a few checkpoints. It shows in the browser tab (as a simplified version that reads at 16 px), in the installed app and on the phone's home screen.
- The PNGs are rendered from the SVG by `tools/icons.cjs`, with a real browser, so they match exactly.
- The Docker and network guide explains the HTTPS needed to install outside `localhost` (Tailscale or Caddy).

## [1.5.0] - 2026-10-17

### Export and share
- The **Export** button became a menu: the usual `.zip`, **Markdown** (the roadmap as text with `- [x]`, projects and, if you want, your notes) and a **page to share**.
- The **page to share** is a single `.html` that opens in any browser, with no server and no internet: Roadkit itself, frozen on that day's progress and read-only, with map, kanban, projects and panels. Notes go along only if you choose.

### Dates
- **Roadmap start**: with the day you started, phase periods and topic times ("Weeks 1 and 2", "Month 2") turn into dates on the map and in the panel, with a warning on what is past due.
- The JSON accepts `meta.startDate` and `due` on phases and topics, which win over the computed dates. `check` validates the format and warns when a phase is due before the previous one.

## [1.4.0] - 2026-10-16

### Search and shortcuts
- `Ctrl+K` (or the magnifier at the top) opens a search that goes to any topic or project of every roadmap, to the roadmaps themselves and to the actions. It ignores accents, accepts skipped letters, and shows each topic's state and the items you opened last.
- Single-letter shortcuts: `/` search, `M` `K` `P` views, `N` next topic, `J` `L` previous and next, `1` to `4` states, `T` light or dark mode and `?` the shortcut list. They never fire while you type and can be turned off in the settings.
- On phones, the search takes the whole screen.

### Under the hood
- `manifest.json` carries a light index of each roadmap's topics and projects, so the search does not need to download every file.

## [1.3.0] - 2026-10-16

### Notes
- Every topic and project has a **My notes** block in the panel, in Markdown, with Write and View tabs. The text saves itself on the server and works offline, like the progress.
- The Markdown supports headings, bold, italics, lists, code, quotes, links and `- [ ]` boxes, which you can check right in the view. Nothing you write becomes HTML.
- Cards with notes get an icon, and the search at the top also looks inside your notes.
- **Roadmap notes**, in the tools, gathers the roadmap's general note and every note in order, and copies it all as Markdown.
- Notes go into the export (`notes.json`) and come back on import. Deleting a roadmap along with its progress deletes its notes too.

## [1.2.1] - 2026-10-16

### Security
- The server no longer serves files from the data folder or the code when the path came encoded (for example `/%64ata/<id>.json`). Before, that let anyone read the saved progress without going through the API and so without the token. Affects versions 1.0.0 to 1.2.0; update if you open Roadkit to other devices.

## [1.2.0] - 2026-10-16

### Projects
- Roadmaps can include hands-on projects at three levels (beginner, intermediate and advanced), in a new optional `projects` field. Roadmaps without projects stay exactly as they were.
- A **Projects** view next to Map and Kanban, with one column per level (tabs on phones), each project's state, the topics it uses and how far along its requirements are.
- In the project panel: states, requirements to check off, deliverable, success criteria, ideas to go further and a field for the link to your repository. All saved on the server, with the progress.
- A project becomes "ready to start" when you finish the topics it uses, with a notice at that moment and a filter to show only those.
- Each topic's panel lists the projects that use it.
- The editor got a projects section, **Create with AI** can ask for projects too, and the agent skill knows how to write them.
- The Argo CD and SQL examples, in both languages, come with projects.

### Under the hood
- The server keeps the parts of the progress a client does not send. That way a browser running the previous version does not erase the projects saved by this one.
- `check` and the schema validate projects: level, repeated ids and topics that do not exist.

## [1.1.0] - 2026-10-16

### Themes
- Seven themes instead of just light and dark: Light, Mist and Paper in light mode; Night, Graphite, Plum and Black in dark mode.
- The settings separate the mode (light, dark or auto) from the theme, with a preview of each. In auto you can pick one theme for each system mode.
- Mist and Black are made for big screens: less glare in light mode, true black in dark mode.
- Anyone already using Roadkit keeps the same look: the default themes are the earlier Light and Night.

## [1.0.0] - 2026-10-16

The first stable version. The roadmap JSON format and the server API now follow semantic versioning: changes that break existing roadmaps only come in a version 2.

### Interface
- Map and kanban for the same roadmap, with four states per topic, tasks inside topics and sub-topics up to two levels deep.
- A roadmap picker with each roadmap's progress and a finished badge, and a screen to manage them: open, duplicate, hide and restore.
- Resizable sidebars, and the left one folds into a strip of icons.
- Light and dark themes, four text sizes and the interface language (Portuguese and English).
- An optional warning when a topic moves ahead before the previous ones are finished.

### Creating roadmaps
- An editor on its own screen, with the form on one side and a live preview on the other. It covers phases, topics, sub-topics, optional topics, colors, logo and category, and has a tab with the full JSON.
- Validation as you type, with the same rules as `check`.
- **Create with AI**: builds a prompt from your goal, and the AI's answer comes back into the editor. No API key needed.
- A skill for coding agents in `.agents/skills/roadkit/`.
- Categories: each subfolder of `roadmaps/` becomes a section, and the editor saves roadmaps into the chosen category.

### Progress and data
- Progress is saved on the server and cached in the browser, so it works on any device and keeps working if the server goes down.
- Export and import a roadmap and its progress as a `.zip`.
- An optional token (`ROADKIT_TOKEN`) to protect reads and writes.

### Server and distribution
- A Python server using only the standard library, with `serve`, `check` and `index` commands.
- A Docker image with a volume for the data and a read-only `roadmaps/` folder.
- Documentation in `docs/` and GIFs generated by a script.

[1.12.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.12.0
[1.11.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.11.0
[1.10.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.10.0
[1.9.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.9.0
[1.8.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.8.0
[1.7.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.7.0
[1.6.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.6.0
[1.5.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.5.0
[1.4.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.4.0
[1.3.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.3.0
[1.2.1]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.1
[1.2.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.2.0
[1.1.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.1.0
[1.0.0]: https://github.com/nycholasmarques/roadkit/releases/tag/v1.0.0
