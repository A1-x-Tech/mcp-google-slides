# Google Slides: Insert text — MCP tool

**Google Slides MCP tool:** Inserts text into a shape or a table cell (batchUpdate insertText) at a 0-based character index (default 0 = the beginning).

Technical name: `insert_text`

## What task it solves

> I want to insert text into a shape or table cell.

Inserts text into a shape or a table cell (batchUpdate insertText) at a 0-based character index (default 0 = the beginning).

## When to use it

Use this capability when you need “Insert text” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `object_id` — **required**. The shape or table object id (from list_slides).
- `text` — **required**. The text to insert; use \n for paragraph breaks.
- `insertion_index` — **optional**. 0-based character index to insert at (default 0 — the start of the existing text).
- `row_index` — **optional**. Table cell row (0-based; requires column_index).
- `column_index` — **optional**. Table cell column (0-based; requires row_index).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool changes real Google Slides data as described above. The server does not promise an automatic rollback.

## Example request

> Insert text in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

For a table cell pass row_index + column_index together. Text carries \n for new paragraphs; the target must be a shape that can hold text or a table — images and lines cannot. To REPLACE what's already there use set_text instead; to fill an empty layout placeholder this works directly (find its object id via list_slides).

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Find & replace text](./replace-text.md) — `replace_text`
- [Set (replace) text](./set-text.md) — `set_text`
- [Style text](./update-text-style.md) — `update_text_style`

## Technical details

- **Impact:** changes data
- **Group:** Text
- **Description source:** `insert_text` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
