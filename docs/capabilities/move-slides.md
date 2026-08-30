# Google Slides: Move slides — MCP tool

**Google Slides MCP tool:** Moves one or more slides to a new position (batchUpdate updateSlidesPosition). slide_object_ids must appear in their current deck order with no duplicates; insertion_index is the 0-based position BEFORE the move is applied (moving a slide down: index counts with the slide still in its old place).

Technical name: `move_slides`

## What task it solves

> I want to reorder slides.

Moves one or more slides to a new position (batchUpdate updateSlidesPosition). slide_object_ids must appear in their current deck order with no duplicates; insertion_index is the 0-based position BEFORE the move is applied (moving a slide down: index counts with the slide still in its old place).

## When to use it

Use this capability when you need “Move slides” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `slide_object_ids` — **required**. The slides to move, listed in their current presentation order.
- `insertion_index` — **required**. 0-based target position, evaluated before the slides are removed from their old places.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Move slides in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Use list_slides to see the current order first.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Add a slide](./add-slide.md) — `add_slide`
- [Delete a slide or element](./delete-object.md) — `delete_object`
- [Duplicate a slide](./duplicate-slide.md) — `duplicate_slide`
- [List layouts and masters](./list-layouts.md) — `list_layouts`

## Technical details

- **Impact:** changes data
- **Group:** Slides and layouts
- **Description source:** `move_slides` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
