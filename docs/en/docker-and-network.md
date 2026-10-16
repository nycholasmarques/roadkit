# Docker and network

## Running with Compose

```bash
docker compose up -d --build     # http://localhost:8765
docker compose logs -f
docker compose down
```

The image is `python:3.12-slim` with Roadkit on top and no dependencies. The service restarts on its own (`restart: unless-stopped`) and runs as an unprivileged user, with no extra capabilities and 128 MB of memory, which is plenty.

There is also a published image, built for amd64 and arm64 on every release:

```bash
docker pull ghcr.io/nycholasmarques/roadkit:1
```

## What lives where

| Inside the container | Where it comes from | What it is for |
|---|---|---|
| `/app/roadmaps` | the `./roadmaps` folder, mounted **read-only** | your file roadmaps |
| `/app/data` | the `roadkit-data` volume | progress and the roadmaps created in the interface |
| `/app/examples`, `/app/src`... | inside the image | the examples and the program itself |

Created or edited a JSON file in `./roadmaps`? Just reload the page, no rebuild. Changed something in `src/` or `tools/`? Then you need `docker compose up -d --build` again.

The `roadkit-data` volume survives `down`, rebuilds and recreating the container. Only `docker compose down -v` deletes it. That is why it is a named volume and not a project folder: Docker creates bind-mounted folders as root, and the container user would not be able to write to them.

## Backing up the volume

```bash
docker run --rm -v roadkit_roadkit-data:/d -v "$PWD":/b alpine \
  tar czf /b/roadkit-data.tgz -C /d .
```

The archive holds one file per roadmap with progress (`<id>.json`), the `roadmaps/` folder with what was created in the interface, and `_hidden.json` with the list of hidden roadmaps. To restore, run the same command the other way around, with `tar xzf`.

If you only want the progress of one roadmap, the **Export** button in the interface already does that, one at a time.

## Opening it to other devices

By default the port only listens on `127.0.0.1`, so only the machine itself can reach it. To use it from your phone or another computer at home, create a `.env` file next to `compose.yaml`:

```
BIND_ADDR=0.0.0.0
PORT=8765
ROADKIT_TOKEN=any-phrase-only-you-know
```

With the token set, the server requires `Authorization: Bearer <token>` to read and save progress and to create, edit or delete roadmaps. The browser asks for the token once and remembers it. The roadmaps (file ones and interface ones) and the interface itself stay open to anyone who can reach the port, since they are just JSON and HTML. The token protects progress and changes.

Some limits, to be clear about what this is and what it is not:

- The server is Python's `http.server`, built for personal use. Do not put it on the internet. Inside your home network it is fine; outside it, put it behind a VPN (WireGuard, Tailscale) or a reverse proxy with HTTPS and authentication.
- Without HTTPS, the token travels in plain text on your network. On a home network the risk is small, but it is worth knowing.
- Writes are only accepted from pages served by the server itself: requests coming from another site are refused. That protects you from some random page trying to change your progress while Roadkit is open.

## Without Docker

```bash
python3 tools/roadkit.py serve --host 0.0.0.0 --port 8765
```

It works the same. Two environment variables change its behavior: `ROADKIT_DATA` points to another folder for the data (the default is `data/` next to the project) and `ROADKIT_TOKEN` turns on the token requirement.
