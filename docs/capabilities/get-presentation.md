# Google Slides: Get a presentation — MCP tool

**Google Slides MCP tool:** Returns the raw presentation JSON: slides[] with every page element (shapes, text runs, tables, images), layouts[], masters[], notesMaster, pageSize (EMU: 1 pt = 12700 EMU) and revisionId.

Technical name: `get_presentation`

## What task it solves

> I want to read the full presentation structure.

Returns the raw presentation JSON: slides[] with every page element (shapes, text runs, tables, images), layouts[], masters[], notesMaster, pageSize (EMU: 1 pt = 12700 EMU) and revisionId.

## When to use it

Use this capability when you need “Get a presentation” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `fields` — **optional**. Optional Google fields mask to trim the response, e.g. "slides(objectId),pageSize".

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> Get a presentation in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

WARNING: a full deck is often hundreds of kilobytes — prefer list_slides for an inventory, and pass fields (a Google fields mask, e.g. "slides(objectId,pageElements(objectId,shape(text)))") to trim this response when you need raw detail.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Raw batchUpdate](./batch-update.md) — `batch_update`
- [Create a presentation](./create-presentation.md) — `create_presentation`
- [Get one page](./get-page.md) — `get_page`
- [List slides (compact inventory)](./list-slides.md) — `list_slides`

## Technical details

- **Impact:** read-only
- **Group:** Presentations
- **Description source:** `get_presentation` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
