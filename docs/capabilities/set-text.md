# Google Slides: Set (replace) text — MCP tool

**Google Slides MCP tool:** Replaces the ENTIRE text of a shape or table cell: one atomic batch of deleteText(ALL) + insertText.

Technical name: `set_text`

## What task it solves

> I want to replace the text of a shape or table cell.

Replaces the ENTIRE text of a shape or table cell: one atomic batch of deleteText(ALL) + insertText.

## When to use it

Use this capability when you need “Set (replace) text” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `object_id` — **required**. The shape or table object id (from list_slides).
- `text` — **required**. The new full text; empty string clears the object. \n starts a new paragraph.
- `row_index` — **optional**. Table cell row (0-based; requires column_index).
- `column_index` — **optional**. Table cell column (0-based; requires row_index).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Set (replace) text” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Set (replace) text in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

If the target has no text yet the delete is skipped automatically, so it works on empty placeholders too. An empty text just clears the object. Replacing text drops per-character styling — restyle with update_text_style afterwards if needed. For a table cell pass row_index + column_index together.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert text](./insert-text.md) — `insert_text`
- [Find & replace text](./replace-text.md) — `replace_text`
- [Style text](./update-text-style.md) — `update_text_style`

## Technical details

- **Impact:** destructive operation
- **Group:** Text
- **Description source:** `set_text` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
