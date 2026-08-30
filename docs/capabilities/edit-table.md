# Google Slides: Edit table structure — MCP tool

**Google Slides MCP tool:** Restructures an existing table in one call. action=insert_rows needs row_index (+optional below, default true, and count 1-20); insert_columns needs column_index (+optional right, default true, and count); delete_row needs row_index and delete_column needs column_index — deletion permanently discards the cells' content, and the remaining rows/columns shift so indexes change between successive edits (re-check with list_slides).

Technical name: `edit_table`

## What task it solves

> I want to insert or delete table rows and columns.

Restructures an existing table in one call. action=insert_rows needs row_index (+optional below, default true, and count 1-20); insert_columns needs column_index (+optional right, default true, and count); delete_row needs row_index and delete_column needs column_index — deletion permanently discards the cells' content, and the remaining rows/columns shift so indexes change between successive edits (re-check with list_slides).

## When to use it

Use this capability when you need “Edit table structure” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `table_object_id` — **required**. The table's object id (type "table" in list_slides).
- `action` — **required**. The structural edit to apply.
- `row_index` — **optional**. Reference row, 0-based (insert_rows / delete_row).
- `column_index` — **optional**. Reference column, 0-based (insert_columns / delete_column).
- `count` — **optional**. How many rows/columns to insert (default 1).
- `below` — **optional**. insert_rows: insert below the reference row (default true; false = above).
- `right` — **optional**. insert_columns: insert to the right of the reference column (default true; false = left).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Edit table structure” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Edit table structure in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Cell TEXT is written with set_text/insert_text (row_index + column_index), not here.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Create a table](./create-table.md) — `create_table`

## Technical details

- **Impact:** destructive operation
- **Group:** Tables
- **Description source:** `edit_table` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
