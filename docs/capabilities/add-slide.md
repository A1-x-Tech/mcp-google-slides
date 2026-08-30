# Google Slides: Add a slide — MCP tool

**Google Slides MCP tool:** Adds a slide (batchUpdate createSlide) and returns the new slide's objectId in the reply.

Technical name: `add_slide`

## What task it solves

> I want to add a slide.

Adds a slide (batchUpdate createSlide) and returns the new slide's objectId in the reply.

## When to use it

Use this capability when you need “Add a slide” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `insertion_index` — **optional**. 0-based position for the new slide; omitted = append at the end.
- `predefined_layout` — **optional**. A predefined layout; the theme's actual layouts may support only a subset.
- `layout_object_id` — **optional**. A concrete layout's object id from list_layouts (alternative to predefined_layout).
- `object_id` — **optional**. Optional custom object id for the new slide (5-50 chars of [a-zA-Z0-9_-:]).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Add a slide in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Pick the look with either predefined_layout (BLANK, TITLE, TITLE_AND_BODY, SECTION_HEADER, ...) or layout_object_id from list_layouts — not both; with neither the slide copies the layout of the current last slide. insertion_index is the 0-based position (omitted = append at the end). Placeholders inherited from the layout arrive empty — find their object ids via list_slides, then fill them with set_text.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Delete a slide or element](./delete-object.md) — `delete_object`
- [Duplicate a slide](./duplicate-slide.md) — `duplicate_slide`
- [List layouts and masters](./list-layouts.md) — `list_layouts`
- [Move slides](./move-slides.md) — `move_slides`

## Technical details

- **Impact:** changes data
- **Group:** Slides and layouts
- **Description source:** `add_slide` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
