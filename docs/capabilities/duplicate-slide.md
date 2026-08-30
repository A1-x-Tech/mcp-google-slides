# Google Slides: Duplicate a slide — MCP tool

**Google Slides MCP tool:** Duplicates a slide (batchUpdate duplicateObject) — the copy, with all its elements and speaker notes, lands immediately after the original and its new objectId comes back in the reply.

Technical name: `duplicate_slide`

## What task it solves

> I want to duplicate a slide.

Duplicates a slide (batchUpdate duplicateObject) — the copy, with all its elements and speaker notes, lands immediately after the original and its new objectId comes back in the reply.

## When to use it

Use this capability when you need “Duplicate a slide” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `slide_object_id` — **required**. The object id of the slide (or page element) to duplicate.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Duplicate a slide in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Works on any page element id too (the copy lands on the same slide, slightly offset). Move the copy with move_slides afterwards if needed.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a slide](./add-slide.md) — `add_slide`
- [Delete a slide or element](./delete-object.md) — `delete_object`
- [List layouts and masters](./list-layouts.md) — `list_layouts`
- [Move slides](./move-slides.md) — `move_slides`

## Technical details

- **Impact:** changes data
- **Group:** Slides and layouts
- **Description source:** `duplicate_slide` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
