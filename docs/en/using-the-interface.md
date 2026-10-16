# Using the interface

<p align="center">
  <img src="../media/visao-geral.gif" alt="Marking a topic as done, moving a card on the kanban and switching to the dark theme" width="100%">
</p>

## What is on the screen

On the left is the sidebar: the logo, the roadmap picker, the phases of the open roadmap and the tools (new roadmap, export, import, reset, open file). At the top of the content are the title, the progress bar, search, the **Next topic** and **Start** buttons, the **Map / Kanban** switch and the settings button. On the right is the details panel for the selected topic.

Both sidebars can be dragged by their edge to make them wider or narrower, and a double click brings them back to the default size. The left one also collapses into a strip of icons with the `‹` button next to the logo, which helps on small screens. Whatever you choose is saved in the browser.

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

The button in the top right corner opens the settings: theme (light, dark or auto), text size, interface language and the skipped topic tolerance. With the language on "Automatic", it follows the `meta.language` of the open roadmap. Picking a fixed language applies to every roadmap.

The last line of the settings shows where progress is being saved: on the server or only in this browser.

## Export and import

**Export** downloads a `.zip` with a folder named after the roadmap, containing the roadmap JSON and a `progress.json`. It is a way to take everything to another machine or keep a copy. **Import** reads that zip back: if the roadmap already exists here, only the progress is applied; if it does not, it opens from the file (to keep it for good, copy the JSON into the `roadmaps/` folder). Import also accepts a bare `progress.json` or a roadmap JSON.

Dragging a `.json` onto the window, or using **Open JSON file**, shows a roadmap without storing anything on the server.

## On a phone

On narrow screens the map becomes a single-column timeline with the phases as shortcuts at the top, and the details panel opens on top like a drawer. While you drag a card, the kanban shows a fixed strip with the four columns, so you can drop the card without scrolling the page.
