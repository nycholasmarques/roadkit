# Using the interface

<p align="center">
  <img src="../media/visao-geral.gif" alt="Marking a topic as done, moving a card on the kanban and switching to the dark theme" width="100%">
</p>

## What is on the screen

On the left is the sidebar: the logo, the roadmap picker, the phases of the open roadmap and the tools (new roadmap, export, import, reset, open file). At the top of the content are the title, the progress bar, search, the **Next topic** and **Start** buttons, the **Map / Kanban** switch and the settings button. On the right is the details panel for the selected topic.

Both sidebars can be dragged by their edge to make them wider or narrower, and a double click brings them back to the default size. The left one also collapses into a strip of icons with the `‹` button next to the logo, which helps on small screens. Whatever you choose is saved in the browser.

## The Today screen

**Today**, at the top of the sidebar (or the `H` key), answers "what do I do now?" by gathering every roadmap on one screen:

- **Continue**: topics and projects in progress or in review, from every roadmap, the one you touched last first. Each row shows the roadmap, the phase, the tasks done and when it last changed. Clicking opens the topic in its roadmap.
- **Up next**: the next topic to do in each roadmap you used in the last 30 days, with the roadmap's progress and the due date, if there is one. With no recent activity, the next topic of the last roadmap you opened shows up under **To get started**.

Hidden roadmaps are left out, and so are the ones you never touched (states the author wrote in the JSON do not count as yours). The button with the roadmap's name, or `Esc`, goes back to it. **Settings → On open** makes Roadkit open straight on the Today screen.

### Spaced review

Off by default. With **Settings → Spaced review** on, every main topic you finish comes back for review 3 days later, in a **To review today** block on the Today screen, and the Today button shows how many reviews are due.

- **I still remember** pushes the next review further: 3, 7, 21, 60 and 150 days. After the last one, the topic leaves the queue.
- **I need to review** starts the intervals over, moves the topic back to "in review" and opens it. It stops counting as finished until you finish it again.

What was already finished when you turn review on stays out of the queue: only what you finish from then on goes in. Optional topics and sub-topics are left out. The **Review this roadmap** box, in the settings, takes a roadmap out of review (handy for project roadmaps that are not about studying). The topic panel shows when the next review is. The queue lives on the server, so it works on every device.

## Focus sessions

Off by default. With **Settings → Focus sessions** on, the panel of every topic and project gets a **Focus** button. It opens a timer in the corner of the screen: pick 25 or 50 minutes, or open-ended (a stopwatch), and start. If the topic was still "to do", the timer offers to move it to "in progress".

- The tab title shows the time left, so you can see it from another tab. Reloading the page or switching roadmaps does not stop the timer.
- At the end a short sound plays and, if you turn on **Notify me when it ends**, a browser notification shows up. The permission is only asked when you turn that option on.
- Sessions of 5 minutes or more are recorded on the topic (even when you stop early), and the panel shows the total: "Focus time: 3 h 20 min in 8 sessions". Offline, they wait in a queue and go up when the server is back.
- After a session, you can take a 5-minute break, which is not recorded.

## The map

The map draws the main topics in order, top to bottom, grouped by phase. Sub-topics and optional explorations sit to the right of their topic, connected by a line. When a topic and the next one are both done, the line between them turns green.

Click a topic to open the details panel: the summary, what to study, the hands-on challenge, the criterion for calling it done, the tasks and the links. The small square in the corner of the card marks it as done without opening anything.

**Next topic** jumps to the first topic that is not done yet. **Start** does the same and is the highlighted one, because it is what you want the first time.

## The kanban

The **Kanban** button swaps the map for a board with four columns: to do, working, review and finished. Each topic is a card. Drag it from one column to another with the mouse, or use the arrows on the card (handy with a keyboard and on a phone).

<p align="center">
  <img src="../media/kanban.png" alt="The kanban board with the topics of the Argo CD roadmap" width="88%">
</p>

A topic's state is the same in both views. Moving a card on the kanban changes its color on the map, and the other way around.

## Projects

Some roadmaps come with hands-on projects, and then a third button shows up: **Map / Kanban / Projects**. The view has one column per level (beginner, intermediate and advanced; tabs on a phone). Each card shows the project's state, the topics it uses (the ones you finished in green) and how many requirements are checked.

A project is **ready to start** when every topic it uses is done. Its card gets a badge, and the **Only the ones I can start now** box hides the rest. When you finish the last missing topic, a notice shows up once at the bottom of the screen, with a shortcut to the project.

Clicking a project opens its panel, which works like a topic's:

- the four states (to do, working, review, finished);
- the topics it uses, each with its state, and a quiet warning if any is missing. It blocks nothing;
- the **requirements**, as checkboxes. Checking the first one moves the project to "working". Marking the project as done checks them all, and moving it back to "to do" clears them all, just like a topic's tasks;
- the deliverable and the success criterion;
- **Going further** 🔥: extra challenges you can check off too. They come in fire colors, and each one you take on lights up its flame. They do not count toward finishing the project, and the card shows how many you have done (🔥 1/2);
- **Your repository**: paste the link to your code so you remember where it is. It is saved with your progress and becomes a button to open it.

In a topic's panel, the **Projects that use this topic** section leads to the projects linked to it. Projects do not count toward the progress bar at the top: it still measures main topics, and the Projects view has its own count.

## Install it and use it offline

Roadkit is an installable app (PWA). In Chrome and Edge the install icon shows up in the address bar, and **Settings → Install as an app** does the same. Once installed, it opens in its own window, with an icon, and can sit in the taskbar or on your phone's home screen. On an iPhone, use **Share → Add to Home Screen**.

After opening it once, Roadkit **opens with no internet**: the interface is kept in the browser, along with a copy of every roadmap in the list, even the ones you never opened on that device. Offline, you keep checking off progress and writing notes; the settings line says it is saving on this device only, and everything goes up to the server when the connection returns.

When a new Roadkit version comes out, a quiet strip at the bottom says **A new version is available · Reload**. It never reloads by itself, so it never interrupts what you are typing.

This works on `http://localhost` and on any HTTPS address. To use it from another device on your network, see [Docker and network](docker-and-network.md#installable-app-and-https).

## Search and keyboard shortcuts

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

## Notes

Every topic and every project has a **My notes** box in its panel. It is yours, not part of the roadmap: the command that worked, the missing link, the open question, the decision you made in the project.

- **Write** opens a text box that grows with its content. The text saves itself half a second after you stop typing, and a line below says whether it reached the server ("Saved") or stayed in the browser. Without a server nothing is lost: the note goes up when it comes back.
- **View** shows the formatted text. It supports basic Markdown: headings (`#`), **bold**, *italics*, lists, `code`, code blocks, quotes, links and `- [ ]` checkboxes, which you can tick right there.
- Topics and projects with notes get an icon on their card, on the map, the kanban and the Projects view.
- The search box at the top also looks inside your notes.
- **Roadmap notes**, in the sidebar tools, gathers everything in one screen: a general note for the roadmap at the top and, below it, the notes of each topic and project in order, with a shortcut to each one. **Copy all as Markdown** takes the whole set to Obsidian, a README or an issue.

Notes go along with **Export** (a `notes.json` inside the zip) and come back with **Import**. Resetting checkmarks does not erase notes; deleting a roadmap with "erase progress and notes" does.

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

## Settings

The button in the top right corner opens the settings: mode (light, dark or auto), theme, text size, interface language, what to open first (the last roadmap or the Today screen), spaced review, focus sessions and the skipped topic tolerance. With the language on "Automatic", it follows the `meta.language` of the open roadmap. Picking a fixed language applies to every roadmap.

The mode says whether the screen is light or dark, and the theme picks the colors for each. There are three light themes and four dark ones:

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

## Export, share and import

**Export** opens a menu with three outputs:

- **Roadmap and progress (.zip)**: a folder named after the roadmap, with the roadmap JSON, a `progress.json` and your notes inside. It is a way to take everything to another machine or keep a copy.
- **Markdown (.md)**: the roadmap as text, with phases as headings, `- [x]` on what is done, tasks, challenges, links, projects and, if you want, your notes at the end. It reads well on GitHub and in Obsidian.
- **Page to share (.html)**: a single file that opens in any browser **with no server and no internet**. It is Roadkit itself, with the map, the kanban, the projects and the panels, frozen at today's progress and read-only. A strip at the top says when the progress is from. Send it to a mentor or publish it on GitHub Pages. The "Include my notes" box decides whether your notes go along.
### Dates

In the same menu, **Roadmap start** takes the day you started (or will start). From it, phase periods and topic times ("Weeks 1 and 2", "Week 3", "Month 2") become dates: each phase flag on the map and each topic panel show "by Sep 14", and anything past its date and not done gets an amber warning. The date is yours and lives with your progress; roadmap authors can also set dates in the JSON (`startDate`, `due`), which win over computed ones. With no date at all, nothing changes on screen.

### Import **Import** reads that zip back: if the roadmap already exists here, only the progress is applied; if it does not, it opens from the file (to keep it for good, copy the JSON into the `roadmaps/` folder). Import also accepts a bare `progress.json` or a roadmap JSON.

Dragging a `.json` onto the window, or using **Open JSON file**, shows a roadmap without storing anything on the server.

## On a phone

On narrow screens the map becomes a single-column timeline with the phases as shortcuts at the top, and the details panel opens on top like a drawer. While you drag a card, the kanban shows a fixed strip with the four columns, so you can drop the card without scrolling the page.
