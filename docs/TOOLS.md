# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Google Slides API mixes reads and writes, so every tool carries explicit MCP
annotations: reads are `readOnlyHint`, updates are idempotent-but-overwriting,
deletes are destructive. Inputs use a normalized snake_case vocabulary in points
(PT); the client maps them to the API's wire values (`STAR_5`, `CENTER_INSIDE`,
field masks, EMU transforms) and handles OAuth entirely on its own.

`presentation_id` is the long id from the URL
(`docs.google.com/presentation/d/<presentationId>/edit`) or from
`create_presentation` output. Everything inside a deck is addressed by
**object ids** — get them from `list_slides` first.

## Presentations

| Tool | Description |
|---|---|
| `create_presentation` | Creates a presentation (only `title` is honored at creation). The new deck starts with one title slide. This server cannot delete a presentation — that is a Drive file operation outside its scope. |
| `get_presentation` | Raw presentation JSON (often hundreds of kB). Supports a Google `fields` mask to trim the response. Prefer `list_slides` for an inventory. |
| `list_slides` | Compact inventory: per slide its index, objectId, layout, speakerNotesObjectId and elements (id, type, placeholder role, visible text ≤160 chars). The read to start from. |
| `get_page` | One page in full — slide, layout, master or notes page. A slide's response embeds its notes page. |
| `batch_update` | Raw `batchUpdate` `requests[]` passthrough for everything the typed tools don't cover (shape fill, backgrounds, paragraph styles, bullets, videos, lines, grouping, cell merges...). Atomic: one invalid request voids the whole batch. |

## Slides & layouts

| Tool | Description |
|---|---|
| `add_slide` | `createSlide` from a `predefined_layout` enum or a concrete `layout_object_id` (from `list_layouts`); optional `insertion_index` and custom `object_id`. Placeholders arrive empty — fill via `set_text`. |
| `duplicate_slide` | `duplicateObject` — the copy lands right after the original (or on the same slide for page elements). |
| `move_slides` | `updateSlidesPosition` — ids must be in current deck order; the insertion index is evaluated before removal. |
| `delete_object` | `deleteObject` for slides and page elements alike. No undo through the API. |
| `list_layouts` | The deck's layouts/masters/notes master. The API cannot import themes — only instantiate existing layouts. |

## Text

| Tool | Description |
|---|---|
| `insert_text` | `insertText` into a shape or table cell (`row_index` + `column_index`) at a character index (default 0). |
| `set_text` | Atomic `deleteText(ALL)` + `insertText`. On an empty target the 400-rejected batch (nothing applied) is re-sent insert-only, so it works on empty placeholders. Empty `text` clears. |
| `replace_text` | `replaceAllText` across the deck or `page_object_ids`; literal match, case-sensitive by default. Returns `occurrencesChanged`. |
| `update_text_style` | `updateTextStyle` with a computed field mask: bold/italic/underline/strikethrough, `font_family`, `font_size_pt`, `foreground_color` (#RRGGBB → rgbColor), `link_url`; whole text or a `start_index`/`end_index` range. |

## Shapes, images, transforms

| Tool | Description |
|---|---|
| `create_shape` | `createShape` from a 14-type normalized enum (the rest via `batch_update`); optional initial `text` chained in the same atomic batch (the object id is generated client-side when omitted so the text can target it). Defaults: 300x80 pt at (50,50). |
| `create_image` | `createImage` from exactly one of `image_url` (validated: https-only, no private/local hosts, ≤2 kB) or `image_path` (magic-byte check PNG/JPEG/GIF, ≤50 MB → Drive multipart upload → anyone-with-link reader → insert → temp file deleted best-effort, on success and failure alike). |
| `replace_image` | `replaceImage` keeping the frame; same image-source handling; `replace_method` center_inside/center_crop. |
| `update_transform` | `updatePageElementTransform`. `absolute` replaces the whole matrix (omitted scale = 1, **not** the current value); `relative` multiplies onto it. |

## Tables

| Tool | Description |
|---|---|
| `create_table` | `createTable` rows x columns (≤20 each at creation). |
| `edit_table` | `action`: `insert_rows` / `insert_columns` (reference index + `below`/`right`, `count`) or `delete_row` / `delete_column` (destructive; indexes shift after each edit). |

## Speaker notes

| Tool | Description |
|---|---|
| `get_speaker_notes` | Resolves the slide's notes page internally and returns the notes as plain text + `speakerNotesObjectId`. |
| `set_speaker_notes` | Rewrites the notes shape atomically (same empty-target fallback as `set_text`); empty text clears. |

## Comments (Drive API, internal dependency)

| Tool | Description |
|---|---|
| `manage_comments` | `action`: `list` (explicit fields mask, pagination, `include_deleted`), `get`, `create` (unanchored — the Drive API cannot anchor new comments to a slide), `reply` (with optional `resolve`), `delete`. Needs a Drive scope on the token. |

## Thumbnails & export

| Tool | Description |
|---|---|
| `get_thumbnail` | Renders a page to PNG: returns a short-lived (~30 min) `contentUrl`, or saves the file when `output_path` is given (download restricted to `*.googleusercontent.com`, no auth header). Expensive-read quota. |
| `export_presentation` | Drive export → local file: `pdf` / `pptx` / `odp` / `txt`. Capped at 10 MB by the export endpoint; needs a Drive scope. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | Calls any Slides API v1 path directly (`GET`/`POST` — the API has no other methods). A path resolving to a foreign origin is rejected (SSRF guard), so the Bearer token never leaves `slides.googleapis.com`; Drive endpoints are deliberately unreachable here. |

## Notes

- **Retry policy:** 429 is retried with backoff for every method (the request was rejected
  before executing); 5xx and network errors are retried **only for GET** — replaying a write
  after an ambiguous failure could duplicate slides or elements.
- **OAuth:** access tokens are minted from the refresh token automatically, cached until ~60s
  before expiry, and re-minted once on a 401.
- **batchUpdate is atomic** — the `set_text` empty-target fallback relies on exactly that: a
  400-rejected batch applied nothing, so re-sending a modified batch cannot double-apply.
- **Units:** tool inputs are points; API responses are EMU (1 pt = 12700 EMU).

## OAuth scopes (minimal)

| Scope | Needed for |
|---|---|
| `https://www.googleapis.com/auth/presentations` | all Slides reads and writes (or `presentations.readonly` for a read-only install) |
| `https://www.googleapis.com/auth/drive.file` | `image_path` upload/cleanup; export/comments on decks **created by this app** |
| `https://www.googleapis.com/auth/drive` | comments and export on arbitrary presentations (`drive.readonly` suffices for export only) |

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_SLIDES_CLIENT_ID` | yes* | — | OAuth2 client id (refresh flow). |
| `GOOGLE_SLIDES_CLIENT_SECRET` | yes* | — | OAuth2 client secret (refresh flow). Secret. |
| `GOOGLE_SLIDES_REFRESH_TOKEN` | yes* | — | OAuth2 refresh token (refresh flow). Secret. |
| `GOOGLE_SLIDES_ACCESS_TOKEN` | yes* | — | Alternative: static access token (~1 h lifetime). Secret. |
| `GOOGLE_SLIDES_API_BASE` | no | `https://slides.googleapis.com` | Slides API root override. |
| `GOOGLE_SLIDES_DRIVE_API_BASE` | no | `https://www.googleapis.com` | Drive API root override (internal dependency). |
| `GOOGLE_SLIDES_TIMEOUT_MS` | no | `60000` | Per-request timeout, ms. |
| `GOOGLE_SLIDES_MAX_RETRIES` | no | `3` | Retries on transient errors. |

\* Either the refresh triple together, or the static access token.
