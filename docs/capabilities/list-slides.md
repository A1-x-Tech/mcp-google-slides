# Google Slides: List slides (compact inventory) — MCP tool

**Google Slides MCP tool:** Compact inventory of the deck — the read to start from: presentationId, title, revisionId, pageSizePt, slideCount and per slide its 0-based index, objectId, layoutObjectId, speakerNotesObjectId and elements[] with each element's objectId, type (shape type / table RxC / image / video / line / group), placeholder role and visible text (truncated to 160 chars).

Technical name: `list_slides`

## What task it solves

> I want to see what is on each slide.

Compact inventory of the deck — the read to start from: presentationId, title, revisionId, pageSizePt, slideCount and per slide its 0-based index, objectId, layoutObjectId, speakerNotesObjectId and elements[] with each element's objectId, type (shape type / table RxC / image / video / line / group), placeholder role and visible text (truncated to 160 chars).

## When to use it

Use this capability when you need “List slides (compact inventory)” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> List slides (compact inventory) in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

All mutation tools address these object ids, so call this before editing; per-element geometry and full text need get_presentation or get_page.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Raw batchUpdate](./batch-update.md) — `batch_update`
- [Create a presentation](./create-presentation.md) — `create_presentation`
- [Get one page](./get-page.md) — `get_page`
- [Get a presentation](./get-presentation.md) — `get_presentation`

## Technical details

- **Impact:** read-only
- **Group:** Presentations
- **Description source:** `list_slides` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
