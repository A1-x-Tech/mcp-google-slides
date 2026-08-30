# Google Slides: Create a shape — MCP tool

**Google Slides MCP tool:** Creates a shape on a slide (batchUpdate createShape), optionally with its initial text in the same atomic batch.

Technical name: `create_shape`

## What task it solves

> I want to add a shape or text box.

Creates a shape on a slide (batchUpdate createShape), optionally with its initial text in the same atomic batch.

## When to use it

Use this capability when you need “Create a shape” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `page_object_id` — **required**. The slide's object id to place the shape on (from list_slides).
- `shape_type` — **required**. The shape type.
- `text` — **optional**. Initial text, inserted in the same atomic batch.
- `x_pt` — **optional**. Left edge in points (requires y_pt; default 50).
- `y_pt` — **optional**. Top edge in points (requires x_pt; default 50).
- `width_pt` — **optional**. Width in points (requires height_pt; default 300).
- `height_pt` — **optional**. Height in points (requires width_pt; default 80).
- `object_id` — **optional**. Optional custom object id (5-50 chars of [a-zA-Z0-9_-:]); auto-generated when omitted.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Create a shape in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Types: text_box, rectangle, round_rectangle, ellipse, diamond, triangle, right_arrow, left_arrow, up_arrow, down_arrow, star, heart, cloud, callout — the API's other ~130 ShapeTypes go through batch_update. Position/size are in points ((0,0) is top-left; a default 16:9 slide is 720x405 pt); omitted geometry defaults to 300x80 pt at (50,50). Returns the shape's objectId in the reply. Fill/outline/shadow are not parameters here — style via batch_update updateShapeProperties; text styling via update_text_style.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert an image](./create-image.md) — `create_image`
- [Replace an image](./replace-image.md) — `replace_image`
- [Move / scale an element](./update-transform.md) — `update_transform`

## Technical details

- **Impact:** changes data
- **Group:** Shapes and images
- **Description source:** `create_shape` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
