# Google Slides: Style text — MCP tool

**Google Slides MCP tool:** Styles the text of a shape or table cell (batchUpdate updateTextStyle): bold, italic, underline, strikethrough, font_family (e.g.

Technical name: `update_text_style`

## What task it solves

> I want to style text: font, size, color and links.

Styles the text of a shape or table cell (batchUpdate updateTextStyle): bold, italic, underline, strikethrough, font_family (e.g.

## When to use it

Use this capability when you need “Style text” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `object_id` — **required**. The shape or table object id whose text to style.
- `bold` — **optional**. Bold on/off.
- `italic` — **optional**. Italic on/off.
- `underline` — **optional**. Underline on/off.
- `strikethrough` — **optional**. Strikethrough on/off.
- `font_family` — **optional**. Font family, e.g. "Roboto" or "Playfair Display".
- `font_size_pt` — **optional**. Font size in points.
- `foreground_color` — **optional**. Text color as #RRGGBB.
- `link_url` — **optional**. Turns the styled range into a hyperlink.
- `start_index` — **optional**. Range start, 0-based character offset (requires end_index).
- `end_index` — **optional**. Range end, exclusive (requires start_index).
- `row_index` — **optional**. Table cell row (0-based; requires column_index).
- `column_index` — **optional**. Table cell column (0-based; requires row_index).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Style text” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Style text in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

"Roboto"), font_size_pt, foreground_color (#RRGGBB) and link_url. Only the provided fields change (the field mask is computed automatically); at least one is required. By default the whole text is styled; pass start_index + end_index (0-based character offsets, end exclusive) to style a range — get the offsets from get_page's textElements. For a table cell add row_index + column_index.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert text](./insert-text.md) — `insert_text`
- [Find & replace text](./replace-text.md) — `replace_text`
- [Set (replace) text](./set-text.md) — `set_text`

## Technical details

- **Impact:** destructive operation
- **Group:** Text
- **Description source:** `update_text_style` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
