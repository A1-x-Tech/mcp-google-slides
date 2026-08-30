# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Slides MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-slides)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-slides)
[![CI](https://github.com/A1-x-Tech/mcp-google-slides/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-slides/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-slides/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-slides)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Slides MCP** lets an AI app build and edit Google Slides presentations in plain language. Draft a deck, add and rearrange slides, write and style text, place shapes, images and tables, keep speaker notes, review comments and export the result as PDF or PPTX.

It uses the Google Slides API with your Google account. Everything inside a deck is addressed by explicit object ids, and it makes the limits of the Slides API explicit instead of implying that every presentation task is possible.

- **26 tools.** Inspect decks and pages, edit slides, text, shapes, images and tables, manage speaker notes and comments, render thumbnails and export files.
- **Edits are atomic.** Changes ride the API's `batchUpdate`: one invalid request voids the whole batch, so a deck is never left half-edited.
- **Your Drive stays out of reach.** Comments, export and local-image upload use the Drive API strictly for the one presentation file — there are no tools to list, share, rename or delete Drive files.
- **Minimal Google scopes.** It needs `presentations`; Drive scopes are required only for local images, comments and export.

Start with a read-only question:

> Show me the slides in the quarterly report deck and what's on each of them.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** List the slides of the Q3 review deck and what's on each one.
>
> **Assistant:** Shows a compact inventory: every slide's position, layout and elements with their visible text. Nothing changes.
>
> **You:** Prepare a new slide after the agenda titled “Roadmap”, with the key dates in the body.
>
> **Assistant:** Shows the target deck, the layout and the proposed text, then asks for confirmation before adding it.
>
> **You:** Confirm.
>
> **Assistant:** Adds the slide and fills its placeholders. It does not touch the other slides.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a presentation changes](#how-a-presentation-changes)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google account and OAuth credentials from a Google Cloud project with the Google Slides API enabled.

1. [Prepare Google OAuth access](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → MCP servers**, select **Add server**, choose **STDIO**, enter the command `npx -y @a1-x-tech/mcp-google-slides@latest` and environment variables `GOOGLE_SLIDES_CLIENT_ID`, `GOOGLE_SLIDES_CLIENT_SECRET`, `GOOGLE_SLIDES_REFRESH_TOKEN`, then select **Save** and **Restart**.

**From the command line:**

```bash
codex mcp add google-slides \
  --env GOOGLE_SLIDES_CLIENT_ID=your_client_id \
  --env GOOGLE_SLIDES_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SLIDES_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-slides@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_SLIDES_CLIENT_ID=your_client_id \
  --env GOOGLE_SLIDES_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_SLIDES_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-slides \
  -- npx -y @a1-x-tech/mcp-google-slides@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

The current official path is **Settings → Extensions**. For a custom desktop extension, open **Advanced settings → Extension Developer → Install Extension…**, select a `.mcpb` file and follow the prompts.

This repository currently publishes an npm stdio package and does not contain a `.mcpb` bundle. For Claude Desktop builds that still support local configuration, use the following JSON stdio configuration as a fallback:

```json
{
  "mcpServers": {
    "google-slides": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "your_client_id",
        "GOOGLE_SLIDES_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

In those builds, save it to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-slides": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "your_client_id",
        "GOOGLE_SLIDES_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-slides": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides@latest"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "${input:slides_client_id}",
        "GOOGLE_SLIDES_CLIENT_SECRET": "${input:slides_client_secret}",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "${input:slides_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "slides_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "slides_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "slides_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Inspect a deck

- List the slides of this presentation and what's on each one.
- Read the speaker notes for slide 5.
- Render a thumbnail of the title slide.

### Build and rearrange slides

- Create a presentation for the Q3 review.
- Add a “Roadmap” slide after the agenda, duplicate the template slide, move the summary to the end.
- Insert an image from a URL or a local file, add a 4×3 table, create a text box or a rounded rectangle with its caption.

### Write and polish text

- Put this text into the title placeholder and make the deadline bold and red.
- Replace “Q2” with “Q3” across the whole deck.
- Rewrite the speaker notes of slide 3 to be shorter.

### Review and hand off

- List the open comment threads and reply to the first one, resolving it.
- Delete the draft slide we no longer need.
- Export the deck as PDF or PPTX for someone without Google access.

## How a presentation changes

1. `create_presentation` creates a **deck** with one title slide; only the title is honored at creation.
2. Everything inside a deck — slides, shapes, images, tables — is addressed by **object ids**. `list_slides` is the compact inventory to start from before any edit.
3. Edits go through the API's atomic `batchUpdate`: one invalid request voids the whole batch, so nothing is half-applied.
4. Tool inputs are in points; the API stores EMU (1 pt = 12700 EMU). The server converts both ways.

The Slides API cannot delete, rename or share the presentation file — those are Drive file operations outside this server's scope. It cannot import a theme (only instantiate layouts the deck already has) and cannot anchor a new comment to a specific slide. Export is capped at 10 MB, and thumbnail URLs expire after about 30 minutes.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Inspect a deck, page, notes or comments; render a thumbnail; export a file | Reads data, writes only local files | No change |
| Create a presentation | Adds a new deck to your Google account | Changes Google Slides |
| Add, duplicate or move slides; create shapes, images, tables | Adds or rearranges deck content | Changes a deck |
| Set or style text, replace an image, transform an element, edit speaker notes or table structure | Overwrites existing content | Changes a deck |
| Find & replace across the deck | Changes every match at once | Changes a deck broadly |
| Delete a slide, element or comment thread | Removes content with no undo through the API | Destructive |
| Raw `batchUpdate` or raw API request | Can call API methods without a dedicated tool | Potentially destructive |

The AI client controls confirmation prompts. The server marks reads, writes and destructive tools so the client can distinguish an inspection from a live change.

## Getting access

Google Slides requires OAuth 2.0; an API key is not enough.

1. Create or select a Google Cloud project and enable **Google Slides API**. Enable **Google Drive API** too if you want comments, export or local-image upload.
2. Configure the OAuth consent screen and create a **Desktop app** OAuth client.
3. Authorize the Google account that owns or can edit the presentations. The [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) can obtain the refresh token when **Use your own OAuth credentials** is enabled.
4. Request the scopes:

   ```text
   https://www.googleapis.com/auth/presentations
   https://www.googleapis.com/auth/drive.file
   ```

   `presentations` covers all Slides reads and writes. `drive.file` covers local-image upload plus comments and export on decks created through this app; request the broader `https://www.googleapis.com/auth/drive` instead when you need comments or export on arbitrary presentations.

Testing-mode OAuth refresh tokens can expire after seven days. Publish the OAuth app, or use an Internal app in a Workspace domain, when you need long-lived access. Treat the client secret and refresh token as passwords.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SLIDES_CLIENT_ID` | Yes* | OAuth client ID. |
| `GOOGLE_SLIDES_CLIENT_SECRET` | Yes* | OAuth client secret. |
| `GOOGLE_SLIDES_REFRESH_TOKEN` | Yes* | OAuth refresh token. |
| `GOOGLE_SLIDES_ACCESS_TOKEN` | Yes* | Short-lived (~1 h) alternative to the OAuth trio. |
| `GOOGLE_SLIDES_API_BASE` | No | Google Slides API base URL override. |
| `GOOGLE_SLIDES_DRIVE_API_BASE` | No | Google Drive API base URL override (internal dependency: comments, export, image upload). |
| `GOOGLE_SLIDES_TIMEOUT_MS` | No | Per-request timeout; default `60000` ms. |
| `GOOGLE_SLIDES_MAX_RETRIES` | No | Temporary-error retries; default `3`. |

\* Provide either the OAuth trio or an access token.

## Data, limits and background work

- **Requests go to Google Slides.** The local server refreshes Google OAuth tokens and calls the Slides API; comments, export and local-image upload ride the Drive API, scoped to the one presentation file. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never OAuth tokens, presentation content, tool arguments or prompts. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies rate limits.** On `429`, the server uses backoff; reads also retry after network and `5xx` errors, while writes are not replayed after an uncertain failure. Thumbnails count against a more expensive read quota.
- **There is no background polling.** The server runs only when called. Nothing watches a deck between calls; if your AI app supports scheduled tasks, it can check a presentation periodically.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Google Slides API reference](https://developers.google.com/slides/api)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-slides/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
