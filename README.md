<h1 align="center">Roadkit</h1>

<p align="center">
  <b>English</b> · <a href="README.pt-BR.md">Português</a>
</p>

<p align="center">
  Interactive roadmaps that come out of a JSON file.<br>
  Map, kanban and saved progress, from a server that fits in a single Python file.
</p>

<p align="center">
  <a href="https://github.com/nycholasmarques/roadkit/releases/latest"><img src="https://img.shields.io/github/v/release/nycholasmarques/roadkit" alt="Latest release"></a>
  <a href="https://github.com/nycholasmarques/roadkit/actions/workflows/ci.yml"><img src="https://github.com/nycholasmarques/roadkit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/nycholasmarques/roadkit" alt="MIT license"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/mapa-escuro.png">
    <img src="docs/media/mapa-claro.png" alt="The GitOps with Argo CD roadmap open in Roadkit" width="100%">
  </picture>
</p>

<p align="center">
  <a href="#running-it">Running it</a> ·
  <a href="#what-you-can-do">What you can do</a> ·
  <a href="docs/en/README.md">Documentation</a> ·
  <a href="docs/en/creating-with-ai.md">Create with AI</a>
</p>

## Why it exists

I wanted to keep several roadmaps, both for projects I want to build and for things I want to learn, all looking the same and without rebuilding the interface for each one. The interface knows nothing about the subject: it only draws what is in the JSON. A new roadmap is just a file, or the editor that comes with it.

The interface speaks English and Portuguese, and follows the language of each roadmap unless you pick one in **Settings**.

## Running it

```bash
python3 tools/roadkit.py serve
```

Open `http://localhost:8765`. All it needs is Python 3: no dependencies, no build. The examples are already in the list. To skip cloning, download the zip from the [latest release](https://github.com/nycholasmarques/roadkit/releases/latest).

<details>
<summary><b>With Docker</b></summary>

With the published image:

```bash
docker run -d -p 127.0.0.1:8765:8765 -v roadkit-data:/app/data ghcr.io/nycholasmarques/roadkit:1
```

Or from the source, with Compose:

```bash
docker compose up -d --build
```

Progress and the roadmaps created in the interface live in a volume, so they survive rebuilds. With Compose, the `./roadmaps` folder is mounted read-only. To open it to your phone or another computer on your network, the token and the other options are in [Docker and network](docs/en/docker-and-network.md).
</details>

## What you can do

### Track

Each topic moves through to do, working, review and finished, on the **map** or on the **kanban**, and both show the same state. Topics have tasks and sub-topics; finishing the one above finishes what is below it. Progress is saved on the server, so what you check off on your laptop shows up on your phone.

<p align="center">
  <img src="docs/media/visao-geral.gif" alt="Checking off a topic, moving a card on the kanban and switching to the dark theme" width="100%">
</p>

### Start your day

The **Today** screen gathers every roadmap: what is in progress, the most recently touched first, and the next topic of each roadmap you are using. It can be the first thing Roadkit opens.

### Build projects

A roadmap can come with hands-on projects from beginner to advanced, each linked to the topics it practices. The **Projects** view shows which ones are within reach, and each project has requirements to check off and a place for the link to your repository.

### Take notes

Every topic and project has a Markdown notes box, saved on the server and offline: the command that worked, the question, the decision. Search finds what you wrote, and a roadmap's notes come out together as Markdown.

### Get there fast

`Ctrl+K` finds any topic, project or action across every roadmap, and single-letter shortcuts change the view, the topic and its state without leaving the keyboard.

### Share

Export the roadmap as Markdown, or as a single `.html` page that opens in any browser with no server, to show your progress to someone.

### Install it, use it offline

Roadkit is an installable app: it opens in its own window, with an icon, and after the first visit it works with no internet, with every roadmap at hand. What you check off offline goes up when the connection returns.

### Create, watching the result

**New roadmap** opens an editor with the form on one side and the real roadmap on the other, drawing itself as you type. You can build phases, topics, sub-topics up to two levels deep, optional topics, colors, logo and category. A line at the bottom tells you what is wrong as you go.

<p align="center">
  <img src="docs/media/criar-roadmap.gif" alt="Building a roadmap in the editor, with the preview next to it" width="100%">
</p>

### Create with an AI

The **Create with AI** button builds a prompt from what you want to learn. You take it to whichever AI you like, paste the answer back, and the roadmap opens in the editor for you to adjust. No API key needed. If you use a coding agent (Claude Code, Codex...), there is also a [skill](.agents/skills/roadkit/SKILL.md) that guides that conversation.

<p align="center">
  <img src="docs/media/criar-com-ia.gif" alt="Describing a goal, copying the prompt and bringing the AI's answer into the editor" width="100%">
</p>

### Organize

Each subfolder of `roadmaps/` becomes a section in the picker, and the picker shows how far along each roadmap is. You can hide, duplicate, export with progress as a `.zip` and import it back. The sidebars resize or collapse, and there are seven themes, three light and four dark, that follow your system's light or dark mode if you want.

## Your roadmaps

A roadmap is a JSON file. The minimum fits in a few lines:

```json
{
  "id": "my-roadmap",
  "meta": { "title": "My roadmap", "language": "en" },
  "nodes": [
    { "id": "first", "title": "First topic", "time": "Week 1" },
    { "id": "second", "title": "Second topic", "time": "Week 2" }
  ]
}
```

Save it in `roadmaps/` (or in a subfolder, which becomes its category) and run `python3 tools/roadkit.py check` to validate it. Reload the page and it is there. The examples in [`examples/`](examples/) show phases, tasks, sub-topics, colors and custom labels, in English and Portuguese.

## Documentation

| | |
|---|---|
| [Using the interface](docs/en/using-the-interface.md) | a tour of the screen |
| [Creating roadmaps](docs/en/creating-roadmaps.md) | three ways to create one, categories and what makes a good roadmap |
| [Creating with AI](docs/en/creating-with-ai.md) | the button and the skill |
| [How it works](docs/en/how-it-works.md) | what runs where, where the data lives, the API |
| [Docker and network](docs/en/docker-and-network.md) | volumes, backups, token, other devices |
| [JSON format](docs/en/SCHEMA.md) | reference for every field |
| [Releasing versions](docs/en/releasing.md) | versioning, automated releases and the [CHANGELOG](CHANGELOG.md) |

The documentation is also available [in Portuguese](docs/README.md).

## License

MIT. See [`LICENSE`](LICENSE).
