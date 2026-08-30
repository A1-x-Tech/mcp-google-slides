# Google Slides: Create a table — MCP tool

**Google Slides MCP tool:** Creates an empty rows x columns table on a slide (batchUpdate createTable) and returns its objectId in the reply.

Technical name: `create_table`

## What task it solves

> I want to add a table.

Creates an empty rows x columns table on a slide (batchUpdate createTable) and returns its objectId in the reply.

## When to use it

Use this capability when you need “Create a table” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `page_object_id` — **required**. The slide's object id to place the table on (from list_slides).
- `rows` — **required**. Row count (the API allows at most 20 rows at creation).
- `columns` — **required**. Column count (the API allows at most 20 columns at creation).
- `x_pt` — **optional**. Left edge in points (requires y_pt).
- `y_pt` — **optional**. Top edge in points (requires x_pt).
- `width_pt` — **optional**. Width in points (requires height_pt).
- `height_pt` — **optional**. Height in points (requires width_pt).
- `object_id` — **optional**. Optional custom object id for the new table.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Create a table in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

Fill cells with set_text / insert_text using row_index + column_index (0-based); restructure later with edit_table. Position/size are in points; omitted geometry lets the API pick a centered default. Cell styling (borders, background) goes through batch_update updateTableCellProperties.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Edit table structure](./edit-table.md) — `edit_table`

## Technical details

- **Impact:** changes data
- **Group:** Tables
- **Description source:** `create_table` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
