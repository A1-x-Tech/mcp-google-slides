# Google Slides: Move / scale an element — MCP tool

**Google Slides MCP tool:** Moves and/or scales a page element (batchUpdate updatePageElementTransform). mode=absolute REPLACES the element's whole transform: translate_x_pt/translate_y_pt become the new top-left-ish origin and omitted scales default to 1 — NOT to the current values, so an absolute move of a scaled element also resets its scale unless you resend it. mode=relative multiplies onto the existing transform: translate shifts by the given points, scale 2 doubles the current size (scaling happens around the origin, which also shifts the element — for a simple move prefer relative translate only).

Technical name: `update_transform`

## What task it solves

> I want to move or scale an element.

Moves and/or scales a page element (batchUpdate updatePageElementTransform). mode=absolute REPLACES the element's whole transform: translate_x_pt/translate_y_pt become the new top-left-ish origin and omitted scales default to 1 — NOT to the current values, so an absolute move of a scaled element also resets its scale unless you resend it. mode=relative multiplies onto the existing transform: translate shifts by the given points, scale 2 doubles the current size (scaling happens around the origin, which also shifts the element — for a simple move prefer relative translate only).

## When to use it

Use this capability when you need “Move / scale an element” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `object_id` — **required**. The page element's object id (from list_slides).
- `mode` — **required**. absolute = replace the whole transform; relative = multiply onto the current one.
- `translate_x_pt` — **optional**. Horizontal translation in points (default 0).
- `translate_y_pt` — **optional**. Vertical translation in points (default 0).
- `scale_x` — **optional**. Horizontal scale factor (default 1).
- `scale_y` — **optional**. Vertical scale factor (default 1).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Move / scale an element” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Move / scale an element in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Element geometry to reason from is in get_page.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert an image](./create-image.md) — `create_image`
- [Create a shape](./create-shape.md) — `create_shape`
- [Replace an image](./replace-image.md) — `replace_image`

## Technical details

- **Impact:** destructive operation
- **Group:** Shapes and images
- **Description source:** `update_transform` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
