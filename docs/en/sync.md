# Sync with GitHub

**English** · [Português](../sincronizar.md)

Roadkit keeps your progress on the server, in the `data/` folder (with Docker, in a volume). That is great while you use a single machine. Sync keeps a copy of everything in a folder of a GitHub repository of yours, so you can use the same path on another computer, have a backup off the machine and, as a bonus, Git's history of every change.

It comes **off**. Until you set it up, the server makes no outside calls at all.

## What goes along

Progress (topics, tasks and projects), notes, activity (what feeds the Today screen and the statistics), the spaced review queue, the roadmaps made in the interface and the hidden list. Roadmaps you keep as files in the `roadmaps/` folder do not go: they already live wherever you version them.

Everything lands in one folder you choose (`roadkit/` by default):

```
roadkit/
  roadkit-sync.json         the format version and the devices that synced
  state/<id>.json           progress
  notes/<id>.json           notes
  activity/<id>.json        activity
  review.json               spaced review
  hidden.json               hidden roadmaps
  roadmaps/...              roadmaps made in the interface
```

The JSON files are indented with sorted keys, so a commit's diff shows only what changed. **Sync never touches anything outside that folder**, so you can use a repository where you keep other things.

## Setting it up

In the settings, under **Sync**, click **Set up...**. There are three steps on the same screen.

### 1. Confirm it is you

The server writes a six-digit code to its own log. Click **Create code** and look:

```bash
docker compose logs roadmap | tail -5
```

(without Docker, the code shows up in the terminal where the server runs). The code is good for 10 minutes, works once and is burned after five wrong tries. Why it exists is under [Security](#security). If your server uses `ROADKIT_TOKEN`, this step does not appear.

### 2. Destination

The repository (`owner/name`, or its link), the branch (`main`) and the folder (`roadkit`). A device name is optional and shows up in commit messages.

The repository has to exist, and it can be empty. **Use a private repository**: your notes and progress go there.

### 3. Token

Roadkit uses a *fine-grained personal access token*, which you create and control:

1. Click **Create the token on GitHub**. The page opens with a name, a 90-day expiry and the **Contents: Read and write** permission already filled in.
2. Under **Repository access**, choose **Only select repositories** and tick only the destination repository.
3. Generate it, copy it and paste it in the **Token** field.

That token can only read and write files in that repository. It does not see your other repositories, issues or account. A classic token (`ghp_...`) works too, but the screen warns you: it covers all of your repositories.

**Test connection** checks everything before saving: whether the token works, reaches the repository, can write, and whether the repository is private. Then **Save**, and the first sync starts right away.

## Manual or automatic

- **Manual**: the **Sync now** button in the settings sends and fetches what changed.
- **Automatic**: the server takes care of it, even with the tab closed. It sends 2 minutes after the last change (a study session with many check-offs becomes one commit) and fetches every 15 minutes and when the server starts. Fetching when nothing changed does not use GitHub's quota.

The status line below the option says what is going on: "Synced with owner/repo 3 min ago", an error with the next try, or "Paused" and why. When the sync needs you, a small dot shows on the settings button. No windows popping up, no banners in the middle of the screen.

## On another machine

Start Roadkit, set up sync with the **same** repository, branch and folder, and that is it: the first sync fetches everything. If that machine already had progress too, Roadkit asks before touching anything:

- **Merge (recommended)**: combines both sides with the rules below.
- **Use GitHub's**: this device becomes the same as the folder.
- **Use this device's**: the folder becomes the same as this device.

## When both sides changed

On every sync, Roadkit compares three versions of each file: the one from the last sync, this device's and GitHub's.

- If only one side changed, that side wins. This is how a deletion (a roadmap deleted with its progress) reaches the other machines.
- If one side deleted and the other changed, the changed one stays: nothing disappears by accident.
- **Progress, notes and review** changed on both sides: the newest wins, the same rule the server already uses with the browser.
- **Activity** changed on both sides: the numbers add up. An hour of focus at home and another at work, the same day, make two hours.
- **A roadmap made in the interface** edited on both machines before syncing: this device's stays, and GitHub's is kept in `data/_sync/conflicts/`, with a note in the status.

If another machine syncs halfway through, or you check off a topic while the sync runs, Roadkit just reads again and merges again.

## Errors and pauses

| Status | What to do |
|---|---|
| no connection to GitHub | nothing: it tries again by itself, waiting longer each time (from 1 minute up to 1 hour) |
| GitHub asked to wait | nothing: it waits as long as GitHub asks |
| GitHub refused the token | the token expired or was revoked: create another and swap it in **Change destination** |
| the token cannot reach the repository | check that the repository is selected on the token and that the permission is **Read and write** |
| the repository became public | if on purpose, confirm it in **Change destination**; if not, make it private again |
| choose how to combine the data | click **Sync now** and choose |
| newer version of Roadkit | the folder was written by a newer version: update this Roadkit |

A pause does not retry by itself, because insisting would not fix it. Seven days before the token expires, the status warns you.

**Disconnect** (in **Change destination**) deletes the token and the settings on this server. Your data here and on GitHub stay as they are.

## Security

This is the first thing in Roadkit that talks to the internet, and with a secret that can write to a repository of yours. So:

- **Where it talks**: only `https://api.github.com`. The address is fixed in the code; nothing you type or that comes from a roadmap changes where the server connects. The certificate is always verified, redirects are never followed, and every answer has a time and size limit.
- **The token** lives only on the server, in `data/_sync/secret.json`, readable only by the server's user. No API answer returns it, or any part of it; it is not in logs, error messages, exports, the zip, Markdown, the page to share or the synced folder. The browser sends the token once and clears the field; nothing is kept in the browser.
- **The pairing code** exists because the real risk is another one: someone who can reach your Roadkit over the network swapping the destination for their own repository and receiving your notes. Only whoever sees the server log can get the code. Switching between manual and automatic, or asking for a sync, does not need the code, because it does not change where the data goes.
- **A public repository** only with your explicit confirmation, and the confirmation is for that repository. If it becomes public later, sync pauses.
- **What comes from GitHub is treated as outside data.** The repository may have been edited by someone else, on GitHub's site or with a leaked token. So each file goes through the same checks as when the browser saves (and roadmaps through `check`) before it reaches `data/`. Odd paths, symbolic links and anything outside the folder are ignored. An invalid file is skipped and shown in the status, without erasing the local version.

What this does **not** protect: anyone with access to the repository reads everything in it. There is no end-to-end encryption. A private repository and a token just for it are the protection.

### Without pasting the token on screen

If you prefer, set the token through the environment, and the screen shows "Set by the environment" instead of the field:

```
ROADKIT_SYNC_TOKEN=github_pat_...
```

Or, with Docker secrets, point to a file with `ROADKIT_SYNC_TOKEN_FILE=/run/secrets/roadkit_sync`. Details are in [Docker and network](docker-and-network.md#sync-with-github).

## The sync's own files

Everything that belongs to the sync lives in `data/_sync/`, which is never served nor synced:

| File | What it keeps |
|---|---|
| `config.json` | destination, mode, device name and the public repository confirmation |
| `secret.json` | the token |
| `base.json` | what both sides had in common at the last sync |
| `status.json` | the last sync, the last error and the next try |
| `conflicts/` | copies of roadmaps edited on both sides |

Deleting `base.json` makes the next sync count as the first (with the question of how to combine). The API routes are in [How it works](how-it-works.md#the-api).
