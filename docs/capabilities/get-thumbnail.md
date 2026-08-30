# Google Slides: Get a slide thumbnail — MCP tool

**Google Slides MCP tool:** Renders one page (slide, layout or master) as a PNG.

Technical name: `get_thumbnail`

## What task it solves

> I want to see how a slide actually renders.

Renders one page (slide, layout or master) as a PNG.

## When to use it

Use this capability when you need “Get a slide thumbnail” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `page_object_id` — **required**. The slide's object id to render (from list_slides).
- `size` — **optional**. Thumbnail width: large=1600px (default), medium=800px, small=200px.
- `output_path` — **optional**. Local file path to save the PNG to; omitted = return the short-lived contentUrl.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> Get a slide thumbnail in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Without output_path it returns contentUrl + width/height — the URL is short-lived (~30 minutes) and served from googleusercontent.com. With output_path the PNG is downloaded and saved to that local file instead (the download is restricted to Google's image hosts). size: large (1600px, default), medium (800px) or small (200px). This is the way to SEE what a slide actually looks like — the JSON never shows rendering. Counts as an expensive read in the API quota.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Export the presentation](./export-presentation.md) — `export_presentation`

## Technical details

- **Impact:** read-only
- **Group:** Thumbnails and export
- **Description source:** `get_thumbnail` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
