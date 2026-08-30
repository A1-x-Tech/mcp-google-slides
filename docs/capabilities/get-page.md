# Google Slides: Get one page — MCP tool

**Google Slides MCP tool:** Returns one page in full by its object id — works for slides, layouts, masters and notes pages alike.

Technical name: `get_page`

## What task it solves

> I want to read one slide, layout or notes page in full.

Returns one page in full by its object id — works for slides, layouts, masters and notes pages alike.

## When to use it

Use this capability when you need “Get one page” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `page_object_id` — **required**. The page's object id — a slide/layout/master/notes-page id from list_slides or get_presentation.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> Get one page in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

For a slide the response includes slideProperties.notesPage (the speaker-notes page) and every pageElement with its size, transform (EMU: 1 pt = 12700 EMU) and complete text. Use it when list_slides' summary is not enough for one page but the whole deck via get_presentation would be too much.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Raw batchUpdate](./batch-update.md) — `batch_update`
- [Create a presentation](./create-presentation.md) — `create_presentation`
- [Get a presentation](./get-presentation.md) — `get_presentation`
- [List slides (compact inventory)](./list-slides.md) — `list_slides`

## Technical details

- **Impact:** read-only
- **Group:** Presentations
- **Description source:** `get_page` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
