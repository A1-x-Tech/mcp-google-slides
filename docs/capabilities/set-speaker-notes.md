# Google Slides: Set speaker notes — MCP tool

**Google Slides MCP tool:** Replaces a slide's speaker notes with the given text (empty string clears them).

Technical name: `set_speaker_notes`

## What task it solves

> I want to write a slide's speaker notes.

Replaces a slide's speaker notes with the given text (empty string clears them).

## When to use it

Use this capability when you need “Set speaker notes” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `slide_object_id` — **required**. The slide's object id (from list_slides) — not the notes page id.
- `text` — **required**. The new speaker notes; empty string clears them. \n starts a new paragraph.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Set speaker notes” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Set speaker notes in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

The tool resolves the slide's speakerNotesObjectId internally and rewrites that shape atomically — you pass the slide's object id, not the notes shape id. Notes are visible in the presenter view and exported by format txt; use \n for paragraphs.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Get speaker notes](./get-speaker-notes.md) — `get_speaker_notes`

## Technical details

- **Impact:** destructive operation
- **Group:** Speaker notes
- **Description source:** `set_speaker_notes` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
