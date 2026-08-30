# CLAUDE.md — mcp-google-slides

MCP server for the Google Slides API v1 (TypeScript, stdio). Mixed read/write:
tools cover presentation/slide CRUD, text, shapes, tables, images, transforms,
speaker notes, layouts, thumbnails, comments and export; `raw_request` is the
escape hatch. The server talks to `https://slides.googleapis.com` with a Bearer
token; comments, export and local-image upload ride the Drive API v3
(`https://www.googleapis.com`) as an **internal dependency** — never exposed as
generic Drive tools. The token is minted from an OAuth2 refresh token via
`https://oauth2.googleapis.com/token` (or a static `GOOGLE_SLIDES_ACCESS_TOKEN`,
mostly for testing).

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live check: read-only by default; GOOGLE_SLIDES_SMOKE_WRITE=1
                   # runs the disposable create→edit→delete scenario with cleanup
```

## Architecture

- `src/config.ts` — env → config. Credentials: either the refresh triple
  `GOOGLE_SLIDES_CLIENT_ID` + `GOOGLE_SLIDES_CLIENT_SECRET` + `GOOGLE_SLIDES_REFRESH_TOKEN`
  (all three or `ConfigError` `incomplete_oauth_config`) or `GOOGLE_SLIDES_ACCESS_TOKEN`;
  optional `GOOGLE_SLIDES_API_BASE`, `GOOGLE_SLIDES_DRIVE_API_BASE`,
  `GOOGLE_SLIDES_TIMEOUT_MS`, `GOOGLE_SLIDES_MAX_RETRIES`. No credentials at all is NOT an
  error: the fields stay `undefined` and the server starts degraded. Also home to
  `CredentialsError` / `MISSING_CREDENTIALS_MESSAGE` (names the variables and the restart)
  and `hasCredentials()`.
- `src/client.ts` — all HTTP and all wire mapping. Token lifecycle (cache until ~60s before
  expiry, dedupe concurrent refreshes, one forced re-mint + replay on 401); `request()`
  resolves the path against the Slides base and rejects foreign origins (SSRF guard — the
  private `driveRequest()` does the same against the Drive base), enforces an AbortController
  timeout that also covers reading the body, retries 429 always but 5xx/network errors
  **only for GET**, and throws `GoogleSlidesError(status, body)`. Typed per-endpoint methods
  build the batchUpdate requests, field masks and EMU/PT conversions; `validateImageUrl()`
  (https-only, no private hosts, ≤2 kB) and `sniffImageType()` (PNG/JPEG/GIF magic bytes,
  ≤50 MB) gate images; `withImageUrl()` implements the local-image flow: Drive multipart
  upload → anyone-with-link reader → use → best-effort delete of the temp file on success
  AND failure. `setText()` exploits batchUpdate atomicity: a 400-rejected delete+insert
  batch applied nothing, so it is re-sent insert-only for empty targets.
  `summarizePresentation()` compacts a fields-masked deck for `list_slides`.
- `src/tools/presentations.ts` — `create_presentation`, `get_presentation`, `list_slides`,
  `get_page`, `batch_update`.
  `src/tools/slides.ts` — `add_slide`, `duplicate_slide`, `move_slides`, `delete_object`,
  `list_layouts`.
  `src/tools/text.ts` — `insert_text`, `set_text`, `replace_text`, `update_text_style`.
  `src/tools/elements.ts` — `create_shape`, `create_image`, `replace_image`,
  `update_transform`.
  `src/tools/tables.ts` — `create_table`, `edit_table` (action-based).
  `src/tools/notes.ts` — `get_speaker_notes`, `set_speaker_notes`.
  `src/tools/comments.ts` — `manage_comments` (action-based; Drive comments for this file).
  `src/tools/export.ts` — `get_thumbnail`, `export_presentation`.
  `src/tools/raw.ts` — `raw_request` (GET/POST — the Slides API has no other methods).
  `src/tools/util.ts` — `ok`/`fail`, the four annotation presets
  (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`) and shared zod schema factories
  (`presentationIdSchema`, `objectIdSchema`, `newObjectIdSchema`, `indexSchema`,
  `pointsSchema`, `hexColorSchema`).
- `src/index.ts` — wires every `register*` into the McpServer. `loadConfigOrDegraded()`
  catches `ConfigError`, pings `startup_failed` (fire-and-forget) and degrades the config to
  "no credentials"; an unconfigured start prepends `UNCONFIGURED_PREFIX` — plus
  `Configuration problem: <message>` when a ConfigError was caught — to the initialize
  `instructions`, and `oninitialized` sends `server_start` for a configured install or
  `unconfigured_start` (with the reason) otherwise.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never data or
  arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `server_start` means "a usable install started"; `unconfigured_start` is a degraded start
  and `startup_failed` a malformed config caught at load — both carry a `reason` from a
  closed vocabulary (`missing_credentials`, `incomplete_oauth_config`) — never a variable's
  name or value.

## Conventions (do not break)

- **Never exit because of configuration.** A server that dies before the MCP handshake leaves
  the user with a red cross and no reason — telemetry across this line of servers showed that
  state accounted for nearly every unconfigured install, and almost none of them recovered.
  Missing credentials are a survivable state: start, answer initialize (with the unconfigured
  prefix in `instructions`) and tools/list, and let the first tool call fail with
  `CredentialsError` — its message names the variables to set and says to restart, because
  credentials come only from the environment. `config.test.ts`, `client.test.ts` and
  `test/dist-smoke.test.js` pin this.
- **Credential failures are not transport failures.** `CredentialsError` is thrown in
  `accessToken()` before any fetch — before the retry/backoff loop, the token mint and the
  401 replay — because retrying it burns seconds of backoff before the user sees the one
  message that helps. Pinned by the "fetch never called" assertion in `client.test.ts`.
- **Never retry a write on 5xx/network errors.** Only 429 (rejected before executing) and GET
  are safe; the gate lives in `requestAgainst()` and is pinned by tests. The one sanctioned
  "resend" is `setText()`'s empty-target fallback, and it is safe only because a 400-rejected
  batch is atomic and applied nothing.
- **No generic Drive surface, ever.** Comments, export and image upload use Drive strictly
  scoped to the one presentation file / the one temp upload; do not add list/share/rename
  tools, and keep `raw_request` pinned to the Slides origin.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized snake_case
  vocabulary in points and must not know the wire enums (`STAR_5`, `CENTER_INSIDE`, field
  masks, EMU) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see tokens; the Bearer header, refresh, caching
  and the 401 replay all live in `requestAgainst()`/`accessToken()`. The thumbnail download
  deliberately carries **no** auth header and only trusts `*.googleusercontent.com`.
- **Everything is addressed by object ids** — descriptions must keep steering the model to
  `list_slides` before any mutation, and `batchUpdate` atomicity must stay documented in the
  instructions (one bad request voids the batch).
- **Image safety is non-negotiable.** URL images: https-only, no private/loopback hosts,
  ≤2 kB (`validateImageUrl`). Local images: magic-byte sniffing, 50 MB cap, temp Drive file
  deleted best-effort on success and failure alike (`withImageUrl`). Both pinned by tests.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  Responses pass through verbatim (describe the fields in the tool `description`, the only
  place the external model reads). `list_slides`/`list_layouts` compact deliberately huge
  responses; keep their summaries lossless on ids.

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it hits a new endpoint, add a method to `src/client.ts` with the wire mapping.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json` must
   match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-slides`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`; the scoped package publishes publicly via `publishConfig`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
