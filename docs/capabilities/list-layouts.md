# Google Slides: List layouts and masters — MCP tool

**Google Slides MCP tool:** Lists the presentation's theme building blocks: layouts[] (objectId, name like TITLE_AND_BODY, displayName, masterObjectId), masters[] and the notesMasterObjectId.

Technical name: `list_layouts`

## What task it solves

> I want to see which layouts and masters the deck has.

Lists the presentation's theme building blocks: layouts[] (objectId, name like TITLE_AND_BODY, displayName, masterObjectId), masters[] and the notesMasterObjectId.

## When to use it

Use this capability when you need “List layouts and masters” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> List layouts and masters in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Layout object ids feed add_slide's layout_object_id; the Slides API cannot import a new theme or change the master set — themes are chosen in the UI, this tool only reads what the deck already has.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a slide](./add-slide.md) — `add_slide`
- [Delete a slide or element](./delete-object.md) — `delete_object`
- [Duplicate a slide](./duplicate-slide.md) — `duplicate_slide`
- [Move slides](./move-slides.md) — `move_slides`

## Technical details

- **Impact:** read-only
- **Group:** Slides and layouts
- **Description source:** `list_layouts` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
