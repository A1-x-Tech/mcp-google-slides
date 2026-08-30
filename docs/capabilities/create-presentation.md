# Google Slides: Create a presentation — MCP tool

**Google Slides MCP tool:** Creates a new Google Slides presentation and returns it (presentationId, revisionId, pageSize, the initial title slide with its object ids, layouts and masters).

Technical name: `create_presentation`

## What task it solves

> I want to create a presentation.

Creates a new Google Slides presentation and returns it (presentationId, revisionId, pageSize, the initial title slide with its object ids, layouts and masters).

## When to use it

Use this capability when you need “Create a presentation” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `title` — **required**. The presentation title (also the Drive file name).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Create a presentation in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

The API honors only the title at creation — add slides with add_slide, content with the text/shape/table/image tools. The new deck starts with one title slide and belongs to the authorized user's Drive. Note: this server cannot delete a presentation; removing the file is a Drive operation outside its scope.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Raw batchUpdate](./batch-update.md) — `batch_update`
- [Get one page](./get-page.md) — `get_page`
- [Get a presentation](./get-presentation.md) — `get_presentation`
- [List slides (compact inventory)](./list-slides.md) — `list_slides`

## Technical details

- **Impact:** changes data
- **Group:** Presentations
- **Description source:** `create_presentation` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
