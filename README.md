# mcp-google-slides

<img src="assets/a1-logo.svg" alt="A1 x Tech" width="80" align="right" />

MCP server for the **Google Slides API v1** (TypeScript, stdio). Create and edit
presentations from any MCP client: slides, text, shapes, tables, images and
transforms, layouts and speaker notes, thumbnails, comments and export — with
OAuth token refresh, safe retries and a raw-API escape hatch.

> Technical README for handover. Full user-facing documentation, marketing copy
> and publication are the next task ([a1-hq#14](https://github.com/A1-x-Tech/a1-hq/issues/14)).

## Quick start

```json
{
  "mcpServers": {
    "google-slides": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-slides"],
      "env": {
        "GOOGLE_SLIDES_CLIENT_ID": "…",
        "GOOGLE_SLIDES_CLIENT_SECRET": "…",
        "GOOGLE_SLIDES_REFRESH_TOKEN": "…"
      }
    }
  }
}
```

Alternative for quick tests: a static `GOOGLE_SLIDES_ACCESS_TOKEN`
(`gcloud auth print-access-token`, ~1 h lifetime). Without any credentials the
server still starts and answers the MCP handshake — every tool call then
explains exactly which variables to set (degraded start, by design).

Minimal OAuth scopes: `https://www.googleapis.com/auth/presentations`, plus
`drive.file` for local-image upload and `drive` for comments/export on arbitrary
decks — see [docs/TOOLS.md](docs/TOOLS.md#oauth-scopes-minimal).

## Tools (26)

| Domain | Tools |
|---|---|
| Presentations | `create_presentation`, `get_presentation`, `list_slides`, `get_page`, `batch_update` |
| Slides & layouts | `add_slide`, `duplicate_slide`, `move_slides`, `delete_object`, `list_layouts` |
| Text | `insert_text`, `set_text`, `replace_text`, `update_text_style` |
| Shapes & images | `create_shape`, `create_image`, `replace_image`, `update_transform` |
| Tables | `create_table`, `edit_table` |
| Speaker notes | `get_speaker_notes`, `set_speaker_notes` |
| Comments | `manage_comments` |
| Thumbnails & export | `get_thumbnail`, `export_presentation` |
| Escape hatch | `raw_request` |

Reference: [docs/TOOLS.md](docs/TOOLS.md) ·
task-oriented catalog: [docs/capabilities/](docs/capabilities/index.md) ·
development: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) ·
publishing: [docs/PUBLISHING.md](docs/PUBLISHING.md)

## Engineering notes

- **Auth**: OAuth2 refresh flow with token caching, deduped refreshes and a single
  forced re-mint + replay on 401; credentials failures fire before any network I/O.
- **Retries**: 429 always (with `Retry-After`); 5xx/network only for GET — a write
  is never replayed after an ambiguous failure. Timeouts cover the response body.
- **Safety**: SSRF guard on raw paths; image URLs validated (https, public hosts,
  ≤2 kB); local images sniffed by magic bytes, uploaded to Drive and the temp file
  deleted after use; no credentials or user content in logs or errors.
- **Drive is internal-only**: comments/export/upload are scoped to the one file —
  no generic Drive tools.
- Anonymous usage telemetry (event/tool names and versions only), opt out with
  `ASKADS_TELEMETRY=0` — details in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#usage-telemetry).

## Known Google Slides API limitations

- No delete/rename/share of the presentation file (Drive-side; out of scope here).
- Themes cannot be imported — only layouts the deck already has can be instantiated.
- New comments cannot be anchored to a specific slide/shape (Drive comments API).
- Export is capped at 10 MB; thumbnails' `contentUrl` expires in ~30 minutes.
- `createImage` requires a publicly fetchable URL (hence the Drive-upload flow for
  local files); PNG/JPEG/GIF only, ≤50 MB, ≤25 megapixels.

## Development

```bash
npm install
npm run typecheck && npm test   # offline suite + dist smoke (real MCP handshake)
npm run smoke                   # live read-only check; GOOGLE_SLIDES_SMOKE_WRITE=1
                                # runs the disposable write scenario with cleanup
```

MIT © A1 x Tech
