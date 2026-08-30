# Google Slides: Replace an image — MCP tool

**Google Slides MCP tool:** Swaps the bitmap of an existing image element while keeping its frame, position and effects (batchUpdate replaceImage).

Technical name: `replace_image`

## What task it solves

> I want to swap the picture inside an existing image element.

Swaps the bitmap of an existing image element while keeping its frame, position and effects (batchUpdate replaceImage).

## When to use it

Use this capability when you need “Replace an image” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `image_object_id` — **required**. The existing image element's object id (type "image" in list_slides).
- `image_url` — **optional**. Public https URL of the new PNG/JPEG/GIF (exactly one of image_url / image_path).
- `image_path` — **optional**. Absolute local path of the new image (exactly one of image_url / image_path).
- `replace_method` — **optional**. How the new image fills the old frame (default center_inside).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Replace an image” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Replace an image in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

The new picture comes from image_url or image_path with exactly the same validation/upload/cleanup rules as create_image. replace_method: center_inside (default — scales to fit inside the frame, keeping aspect) or center_crop (fills the frame, cropping the overflow).

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert an image](./create-image.md) — `create_image`
- [Create a shape](./create-shape.md) — `create_shape`
- [Move / scale an element](./update-transform.md) — `update_transform`

## Technical details

- **Impact:** destructive operation
- **Group:** Shapes and images
- **Description source:** `replace_image` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
