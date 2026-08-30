# Google Slides: Delete a slide or element — MCP tool

**Google Slides MCP tool:** Deletes a slide or a page element (shape, image, table, video, line, group) by object id — batchUpdate deleteObject.

Technical name: `delete_object`

## What task it solves

> I want to delete a slide or an element.

Deletes a slide or a page element (shape, image, table, video, line, group) by object id — batchUpdate deleteObject.

## When to use it

Use this capability when you need “Delete a slide or element” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `object_id` — **required**. The object id of the slide or page element to delete (from list_slides).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Delete a slide or element” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Delete a slide or element in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Deleting a slide removes all its elements and speaker notes; deleting a group removes its children. There is no undo through the API (version history lives in the Slides UI). It cannot delete the whole presentation — that is a Drive file operation outside this server.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a slide](./add-slide.md) — `add_slide`
- [Duplicate a slide](./duplicate-slide.md) — `duplicate_slide`
- [List layouts and masters](./list-layouts.md) — `list_layouts`
- [Move slides](./move-slides.md) — `move_slides`

## Technical details

- **Impact:** destructive operation
- **Group:** Slides and layouts
- **Description source:** `delete_object` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
