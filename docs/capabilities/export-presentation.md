# Google Slides: Export the presentation — MCP tool

**Google Slides MCP tool:** Downloads the whole presentation as pdf, pptx, odp or txt (txt = all text incl. speaker notes) and saves it to output_path, overwriting an existing file.

Technical name: `export_presentation`

## What task it solves

> I want to download the deck as PDF, PPTX, ODP or text.

Downloads the whole presentation as pdf, pptx, odp or txt (txt = all text incl. speaker notes) and saves it to output_path, overwriting an existing file.

## When to use it

Use this capability when you need “Export the presentation” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `format` — **required**. The export format.
- `output_path` — **required**. Local file path to write, e.g. /tmp/deck.pdf — existing files are overwritten.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> Export the presentation in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Served by the Drive export endpoint internally, which caps exports at 10 MB — a bigger deck fails with an export-size error (split it or use the Slides UI). Requires a Drive scope on the OAuth token (drive.readonly is enough; presentations-only gets a 403). Returns saved_to, bytes and mime_type; nothing in the presentation changes.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get a slide thumbnail](./get-thumbnail.md) — `get_thumbnail`

## Technical details

- **Impact:** read-only
- **Group:** Thumbnails and export
- **Description source:** `export_presentation` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
