# Google Slides: Raw batchUpdate — MCP tool

**Google Slides MCP tool:** Sends raw Slides API batchUpdate requests for anything the typed tools don't cover: updateShapeProperties (fill, outline, shadow), updatePageProperties (slide background), updateParagraphStyle, createParagraphBullets, updateTableCellProperties, mergeTableCells, createVideo, createLine, groupObjects, updateSlideProperties and the rest of the request union. requests is the API's requests[] array verbatim, e.g. [{"updateShapeProperties":{"objectId":"...","shapeProperties":{...},"fields":"shapeFill"}}].

Technical name: `batch_update`

## What task it solves

> I want to send raw batchUpdate requests the typed tools don't cover.

Sends raw Slides API batchUpdate requests for anything the typed tools don't cover: updateShapeProperties (fill, outline, shadow), updatePageProperties (slide background), updateParagraphStyle, createParagraphBullets, updateTableCellProperties, mergeTableCells, createVideo, createLine, groupObjects, updateSlideProperties and the rest of the request union. requests is the API's requests[] array verbatim, e.g. [{"updateShapeProperties":{"objectId":"...","shapeProperties":{...},"fields":"shapeFill"}}].

## When to use it

Use this capability when you need “Raw batchUpdate” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `requests` — **required**. The Slides API batchUpdate requests[] array, verbatim wire format.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Raw batchUpdate” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Raw batchUpdate in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

The batch is atomic: one invalid request rejects the whole batch and nothing is applied. Lengths/coordinates take {"magnitude":N,"unit":"PT"}; wire enums are UPPER_CASE.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a presentation](./create-presentation.md) — `create_presentation`
- [Get one page](./get-page.md) — `get_page`
- [Get a presentation](./get-presentation.md) — `get_presentation`
- [List slides (compact inventory)](./list-slides.md) — `list_slides`

## Technical details

- **Impact:** destructive operation
- **Group:** Presentations
- **Description source:** `batch_update` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
