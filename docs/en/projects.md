# Projects

A roadmap says what to study; a project is where you use it. Projects cut across several topics, come in three levels (beginner, intermediate and advanced) and have their own progress: requirements, extra challenges and the link to your repository.

<p align="center">
  <img src="../media/projetos.gif" alt="Opening the Projects view, checking requirements and an extra challenge, and finishing the project" width="100%">
</p>

## In the interface

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

<p align="center">
  <img src="../media/projetos.png" alt="The Projects view with one column per level and a project panel open" width="88%">
</p>

## Writing projects in the JSON

Projects live in an optional `projects` field of the roadmap. A good project is small enough to finish and big enough to use more than one topic:

```jsonc
"projects": [
  {
    "id": "library-queries",
    "title": "Queries on a library catalog",
    "level": "beginner",
    "summary": "Answer real questions about the data of a small library.",
    "uses": ["environment", "select", "aggregation"],
    "requirements": [
      { "id": "questions", "title": "Write 6 questions the data should answer" },
      { "id": "queries", "title": "Answer each question with a query" }
    ],
    "deliverable": "A repository with the .sql file and a README.",
    "stretch": ["A question that needs a JOIN"],
    "time": "2 to 3 days"
  }
]
```

- `uses` links the project to topics: when all of them are done, it becomes **ready to start**. That is what makes the project show up at the right time.
- `requirements` becomes a checklist; each item has an `id` that keeps what you checked.
- `stretch` holds the 🔥 challenges, which do not count toward finishing.
- **Create with AI** and the agent skill know how to write projects; ask for them along with the roadmap.

The reference for every field, with the limits `check` enforces, is in [JSON format](SCHEMA.md#projects-optional).
