# Obsidian Deck

![Downloads](https://raw.githubusercontent.com/yut0takagi/obsidian-deck-dashboard/main/.github/stats/badge.svg)

![Download history](https://raw.githubusercontent.com/yut0takagi/obsidian-deck-dashboard/main/.github/stats/downloads.svg)

Deck puts your tasks, calendar and notes on one dashboard, so the moment you open Obsidian you can see where today stands. A dashboard is a `.dashboard` file made of widgets you can add, reorder and resize.

## Widgets

| Widget | What it shows | Needs |
| --- | --- | --- |
| Today | Today's date and a link that opens (or creates) today's daily note | A daily notes folder, or the core Daily notes plugin |
| Kanban | Notes in your task folder as cards in columns by their `status` field; drag a card to change it | Task notes folder |
| Gantt | Task notes on a timeline (from their due date and effort), or the events of a Markwhen `.mw` file | Task notes folder, or a Markwhen file |
| Charts | Small charts: tasks completed in the last 30 days, notes created, tasks by project and by status | Task notes folder (except the "notes created" chart) |
| Task creator | A form that creates a task note with frontmatter | Task notes folder |
| Counter / KPI | A big number: how many results a Dataview query returns | [Dataview](https://github.com/blacksmithgu/obsidian-dataview) |
| Dataview query | The result of any Dataview DQL or DataviewJS query | Dataview |
| Base | A `.base` file (Obsidian Bases), optionally one of its views, shown the same way as `![[file.base]]` in a note | Obsidian 1.9+ with the Bases core plugin on; otherwise the widget says so |
| Markdown | Free text written in Markdown | — |
| Note embed | A preview of one note | — |
| Calendar (iCal) | Events from an iCal (`.ics`) URL, such as a private calendar address | An iCal URL |
| Google Calendar | Your Google Calendar events | Google sign-in (desktop) |
| Mail (Gmail) | Your Gmail inbox; opens a mail pane with threads, labels, attachments and AI reply drafts | Google sign-in (desktop) |
| AI search | Ask in natural language; Claude picks the matching notes and explains why | Claude Code CLI or an Anthropic API key |

Kanban cards dropped into the `AI移譲` column can be handed to Claude Code, which works on the task in your vault and writes a log of what it did (desktop only).

## Install

1. In Obsidian, open **Settings → Community plugins** and turn off Restricted mode if it is on.
2. Select **Browse**, search for **Deck**, then **Install** and **Enable**.

To install by hand, copy `main.js`, `manifest.json` and `styles.css` from a [release](https://github.com/yut0takagi/obsidian-deck-dashboard/releases) into `<vault>/.obsidian/plugins/deck-dashboard/`.

## Getting started

1. Run **Deck: Open home dashboard** from the command palette, or click the dashboard icon in the ribbon. The first time, it creates `Home.dashboard` from a template.
2. Widgets that need a folder you have not set yet say so and offer an **Open settings** button. Set the folders in **Settings → Deck** and the dashboard redraws.
3. Turn on **Open the home dashboard on startup** if you want it every time Obsidian starts.

Use ⚙ on a widget to edit it, ✎ for edit mode (drag to reorder, change width and height), and **+ ウィジェット追加** to add widgets.

## Settings

Settings → Deck starts with the home dashboard and the folders widgets read. Each folder field suggests existing folders as you type.

| Setting | Used by | New installs |
| --- | --- | --- |
| Home dashboard file | "Open home dashboard", ribbon icon, startup | `Home.dashboard` |
| Open the home dashboard on startup | Startup; switches to the tab if it is already open | Off |
| Folder for new dashboards | "Create new dashboard" | Vault root |
| Task notes | Kanban, Gantt, Charts, Task creator, Sheets sync, `{{taskFolder}}` | Not set |
| Daily notes | Today widget (falls back to the core Daily notes plugin) | Not set |
| Meeting notes | `{{meetingFolder}}` | Not set |
| Markwhen file | Gantt widget with the Markwhen source | Not set |
| AI delegation logs | AI delegation (required before delegating) | Not set |
| Sheets sync logs | One line per sync in a daily `.jsonl` file | Not set (no log) |
| Notes saved from AI search | The "save as note" button of AI search | Not set |
| Folders excluded from AI search | AI search and AI mail replies | None |

A folder written in a widget's own settings (⚙) wins over these. Folders already written in an existing `.dashboard` file are kept as they are.

**Upgrading from 0.0.x:** if the plugin already had saved data, the folders that older versions used without asking are kept, so your dashboards keep working. You can change them in Settings → Deck.

### Folder tokens in Dataview queries

Counter and Dataview widgets replace these tokens with the folders from Settings → Deck, so one dashboard works in any vault:

```
LIST FROM "{{taskFolder}}" WHERE status != "完了"
```

`{{taskFolder}}`, `{{meetingFolder}}` and `{{dailyFolder}}` are supported. While a folder used by a query is not set, the widget asks you to set it instead of querying the whole vault.

### Task notes

Kanban, Gantt, Charts, Task creator and Sheets sync read task notes from their frontmatter. The field names follow the plugin's original Japanese schema:

```yaml
---
status: 作業中      # Kanban column; 完了 = done
期限: 2026-11-30    # due date
優先度: High        # priority
PJT: Website        # project (Gantt groups, charts)
工数: 2h            # effort, used for the Gantt bar length
---
```

Kanban and Gantt let you change the status field, the columns and the other field names in each widget's settings. Subfolders of the task folder (`Tasks/alice/…`) are treated as members and shown as tabs.

## Commands

- Create new dashboard
- Open home dashboard
- Reset home dashboard to template
- Add widget to active dashboard
- Toggle dashboard edit mode
- メールを開く (Gmail)
- Google Calendar: Authenticate / setup credentials, Sign out, List calendars
- Sheets Sync: Setup personal / org sheet, Sync now, Show status, Toggle auto-sync

## Network use and privacy

Deck does not collect analytics or telemetry. It only connects to a service when you use the feature that needs it:

| Feature | Connects to | What is sent |
| --- | --- | --- |
| Google sign-in | `accounts.google.com` (in your browser), `oauth2.googleapis.com` | Your own OAuth client ID and secret, the authorization code and refresh token. During sign-in a temporary server listens on `127.0.0.1` (random port) to receive the redirect, and stops afterwards. |
| Google Calendar widget | `www.googleapis.com/calendar/v3` | Read-only requests for your calendars and events |
| Mail (Gmail) | `www.googleapis.com/gmail/v1` | Reads threads, labels and attachments; changes labels, moves mail to trash and creates drafts when you ask. Deck never sends mail itself: it creates a draft and opens `mail.google.com` in your browser for you to send. |
| Sheets sync | `sheets.googleapis.com/v4` | Creates a spreadsheet and reads/writes the task rows (title, project, owner, due date, status …) |
| Calendar (iCal) widget | The URL you enter | A GET request for the calendar file |
| AI search / AI mail reply, API backend | `api.anthropic.com` | Your question (or the mail thread) and short excerpts of the notes picked as candidates, with your Anthropic API key |
| AI search / AI mail reply / AI delegation, Claude Code backend | Runs the `claude` command on your computer | The same prompt is passed to Claude Code, which talks to Anthropic with your own Claude account. "Web で調べる" asks Claude Code to search the web. |
| AI delegation | Runs `claude` in your vault folder | Claude Code can read and edit files and run commands in the vault, within the permission mode you choose |

Google OAuth uses a client you create yourself in Google Cloud. Requested scopes: `calendar.readonly`, `spreadsheets`, `drive.file`, `gmail.modify`. Google sign-in and Claude Code are available on desktop only.

### What is stored where

- `<vault>/.obsidian/plugins/deck-dashboard/data.json`: settings, the Sheets sync configuration, and the Google OAuth client, Google tokens and Anthropic API key in plain text. Keep this file out of public repositories and shared vaults.
- `.dashboard` files: each widget's settings, including an iCal URL you paste. A private iCal address works like a password, so don't share a dashboard that contains one.
- AI delegation logs and Sheets sync logs are written as notes in the folders you choose.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT
