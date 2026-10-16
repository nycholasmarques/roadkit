# Creating with AI

The idea is simple: a roadmap is a JSON file, and writing JSON is something an AI is good at. What it does not know is Roadkit's format, or what you want to learn. The two paths below solve that, each in its own way.

## With the "Create with AI" button

It works with any AI (ChatGPT, Claude, Gemini, a local model), because Roadkit does not talk to any of them. It only builds the text you take there and brings the answer back. It asks for no API key and sends nothing anywhere.

<p align="center">
  <img src="../media/criar-com-ia.gif" alt="Describing the goal, copying the prompt and bringing the AI's answer into the editor" width="100%">
</p>

1. Open **New roadmap** and click **Create with AI**.
2. Say what you want to learn or do, and pick the language and the size. The more context you give (what you already know, how much time you have), the better the result.
3. Click **Copy prompt**, paste it into your AI and wait for the answer.
4. Paste the answer into the third box and click **Use in the editor**.

The roadmap opens in the editor, with the preview next to it. The answer can come inside a ```` ```json ```` block or with a sentence before and after; Roadkit picks out just the JSON object. If the `id` the AI chose already exists here, it is replaced with a free one.

From there it is the usual editor. The problem line at the bottom validates as you edit, so if the AI got something wrong (a parent that does not exist, a duplicate id) you see it right away and fix it in the form or in the JSON tab.

The prompt text lives in [`src/ai-prompt.txt`](../../src/ai-prompt.txt). If you want the AI to write differently (more direct, more detailed), just edit that file.

## With the agent skill

If you use a coding agent, the repository ships a skill in [`.agents/skills/roadkit/`](../../.agents/skills/roadkit/SKILL.md). It is a guided conversation instead of a single prompt. The `.agents/skills/` folder is the convention used by several tools. If yours looks somewhere else (Claude Code, for example, looks in `.claude/skills/`), copy or link the `roadkit/` folder there.

Open Claude Code inside the Roadkit folder and ask for something like "build me a roadmap to learn Rust" (or call it directly with `/roadkit`). The skill then:

1. Asks for what it still needs to know: goal, starting point, time, language and category. If you already said it, it does not ask again.
2. Shows the outline as text (phases, topics and time estimates) and waits for your ok before writing the file. Changing a ten-line list is much easier than changing a JSON file.
3. Writes the file to `roadmaps/<category>/` and runs `check`. If the server runs in Docker, with the `roadmaps/` folder read-only, it saves through the server's API, which stores it in the data volume.
4. Tells you how to open it and stays around for adjustments: changing a time estimate, splitting a topic into sub-topics, cutting what is left over.

To evolve an existing roadmap, it reads the file first, keeps what you did not ask to change and leaves the `id`s alone, so your saved progress still applies.

If your tool does not read that folder, you can still use the same text: `SKILL.md` is plain Markdown.

## What the AI gets right and what it gets wrong

It almost always gets the structure right, and `check` catches the rest. The content needs a human eye:

- **Links.** This is where models make things up the most. The prompt asks only for links it is sure exist, but check the ones that remain. When in doubt, delete them.
- **Time estimates.** They tend to be optimistic. Read "Week 2" and ask yourself whether you would really do that in a week.
- **Generic challenges.** "Practice what you learned" is not a challenge. Ask for "a concrete challenge I can check on my own" and the answer gets better.
- **Size.** If it came back with too much, ask it to merge topics or move some of them to optional.

[Creating roadmaps](creating-roadmaps.md#what-makes-a-roadmap-pleasant-to-use) has the rules I use for reviewing, and they apply to what the AI returned just as much as to what you wrote yourself.
