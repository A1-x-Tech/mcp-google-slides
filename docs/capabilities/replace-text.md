# Google Slides: Find & replace text — MCP tool

**Google Slides MCP tool:** Finds and replaces every occurrence of a string across the whole deck — shapes and table cells on slides, and their speaker notes (batchUpdate replaceAllText).

Technical name: `replace_text`

## What task it solves

> I want to find and replace text across the deck.

Finds and replaces every occurrence of a string across the whole deck — shapes and table cells on slides, and their speaker notes (batchUpdate replaceAllText).

## When to use it

Use this capability when you need “Find & replace text” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `find` — **required**. The literal text to find (no regex).
- `replace` — **required**. The replacement text (empty string deletes the matches).
- `match_case` — **optional**. Case-sensitive matching (default true).
- `page_object_ids` — **optional**. Limit the replacement to these slides/pages (default: the whole presentation).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Find & replace text” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Find & replace text in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Scope it with page_object_ids to touch only specific slides. Matching is literal (no regex), case-sensitive by default (match_case=false to ignore case). Returns occurrencesChanged in the reply — 0 means nothing matched, check the exact wording with list_slides. The classic template flow: duplicate a template deck, then replace {{placeholders}}.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Insert text](./insert-text.md) — `insert_text`
- [Set (replace) text](./set-text.md) — `set_text`
- [Style text](./update-text-style.md) — `update_text_style`

## Technical details

- **Impact:** destructive operation
- **Group:** Text
- **Description source:** `replace_text` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
