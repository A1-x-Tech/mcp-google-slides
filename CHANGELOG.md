# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-08-30

### Added

- First release: a full MCP server for the Google Slides API v1 (stdio,
  TypeScript, `@modelcontextprotocol/sdk` + `zod`).
- Tools (26):
  - `create_presentation`, `get_presentation` (with `fields` masks),
    `list_slides` (compact per-slide inventory with element ids/types/text),
    `get_page`, `batch_update` — raw atomic batchUpdate passthrough;
  - `add_slide` (predefined or concrete layouts), `duplicate_slide`,
    `move_slides`, `delete_object`, `list_layouts`;
  - `insert_text`, `set_text` (atomic delete+insert with an empty-target
    fallback that relies on batchUpdate atomicity), `replace_text`,
    `update_text_style` (computed field masks, hex → rgbColor);
  - `create_shape` (normalized 14-type enum, optional initial text in the same
    atomic batch), `create_image` / `replace_image` (public URL validated:
    https-only, no private hosts, ≤2 kB; or a local file sniffed by magic
    bytes, uploaded to Drive, inserted and the temp file deleted best-effort on
    success and failure alike), `update_transform` (absolute/relative, points);
  - `create_table`, `edit_table` (insert/delete rows and columns);
  - `get_speaker_notes` / `set_speaker_notes` (the notes shape is resolved
    internally from the slide id);
  - `manage_comments` — Drive comment threads scoped to the one file
    (list/get/create/reply+resolve/delete);
  - `get_thumbnail` (short-lived contentUrl or a saved PNG; downloads only from
    `*.googleusercontent.com`, without auth), `export_presentation`
    (pdf/pptx/odp/txt via Drive export, 10 MB cap);
  - `raw_request` — escape hatch to any Slides API v1 path (SSRF-guarded,
    Slides origin only).
- Degraded start: without credentials the server still completes the MCP
  handshake, serves the full tool list, opens the instructions with the fix and
  fails tool calls with an actionable `CredentialsError` naming the
  `GOOGLE_SLIDES_*` variables.
- OAuth2 refresh flow: access tokens minted from
  `GOOGLE_SLIDES_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, cached until just
  before expiry, deduped across concurrent requests and re-minted once on a 401;
  a static `GOOGLE_SLIDES_ACCESS_TOKEN` works as an alternative.
- Resilience: request timeout covering body reads, `Retry-After`-aware backoff,
  429 retried for every method, 5xx/network retries gated to reads so writes are
  never replayed.
- Anonymous usage telemetry (event/tool names and versions only; opt out with
  `ASKADS_TELEMETRY=0`), including the `startup_failed`/`unconfigured_start`
  drop-off pings.
- Offline test suite (123 tests): mocked-fetch client tests incl. the OAuth
  flow, the Drive upload/cleanup flow and export/thumbnail downloads,
  fake-server tool tests, pinned per-tool annotations, capability-doc coverage,
  plus a dist smoke test that spawns the built binary and performs a real MCP
  handshake over stdio (configured and unconfigured).
- Opt-in live smoke: read-only by default; `GOOGLE_SLIDES_SMOKE_WRITE=1` runs a
  disposable create→edit→verify→delete scenario with cleanup on success and
  error.
- CI (Node 20/22/24: typecheck + build + tests) and a daily live health check
  that skips itself when repo secrets are absent.
- Docs: technical reference (`docs/TOOLS.md`), a task-oriented capability page
  per tool (`docs/capabilities/`), development and publishing guides.

[0.1.0]: https://github.com/A1-x-Tech/mcp-google-slides/releases/tag/v0.1.0
