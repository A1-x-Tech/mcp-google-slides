# Google Slides: Insert an image — MCP tool

**Google Slides MCP tool:** Inserts an image on a slide (batchUpdate createImage) from EITHER image_url — a public https URL Google's servers can fetch (validated: https-only, no private/local hosts, ≤2 kB; the image itself must be PNG/JPEG/GIF, ≤50 MB, ≤25 megapixels) — OR image_path, a local file that is checked by magic bytes, uploaded to Drive, shared by link for the fetch and DELETED from Drive right after (Slides stores its own copy, so the temp file is disposable; the result reports the cleanup).

Technical name: `create_image`

## What task it solves

> I want to insert an image from a URL or a local file.

Inserts an image on a slide (batchUpdate createImage) from EITHER image_url — a public https URL Google's servers can fetch (validated: https-only, no private/local hosts, ≤2 kB; the image itself must be PNG/JPEG/GIF, ≤50 MB, ≤25 megapixels) — OR image_path, a local file that is checked by magic bytes, uploaded to Drive, shared by link for the fetch and DELETED from Drive right after (Slides stores its own copy, so the temp file is disposable; the result reports the cleanup).

## When to use it

Use this capability when you need “Insert an image” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `page_object_id` — **required**. The slide's object id to place the image on (from list_slides).
- `image_url` — **optional**. Public https URL of a PNG/JPEG/GIF (exactly one of image_url / image_path).
- `image_path` — **optional**. Absolute local path of a PNG/JPEG/GIF file (exactly one of image_url / image_path).
- `x_pt` — **optional**. Left edge in points (requires y_pt).
- `y_pt` — **optional**. Top edge in points (requires x_pt).
- `width_pt` — **optional**. Width in points (requires height_pt).
- `height_pt` — **optional**. Height in points (requires width_pt).
- `object_id` — **optional**. Optional custom object id for the new image.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Insert an image in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Omitted size keeps the image's native proportions fitted to the page; position/size are in points. Returns the image objectId in the reply.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a shape](./create-shape.md) — `create_shape`
- [Replace an image](./replace-image.md) — `replace_image`
- [Move / scale an element](./update-transform.md) — `update_transform`

## Technical details

- **Impact:** changes data
- **Group:** Shapes and images
- **Description source:** `create_image` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
