# Google Slides: Get speaker notes — MCP tool

**Google Slides MCP tool:** Returns a slide's speaker notes as plain text, plus the speakerNotesObjectId (the text shape on the slide's hidden notes page).

Technical name: `get_speaker_notes`

## What task it solves

> I want to read a slide's speaker notes.

Returns a slide's speaker notes as plain text, plus the speakerNotesObjectId (the text shape on the slide's hidden notes page).

## When to use it

Use this capability when you need “Get speaker notes” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `slide_object_id` — **required**. The slide's object id (from list_slides) — not the notes page id.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The tool reads Google Slides data and does not change it.

## Example request

> Get speaker notes in Google Slides. Ask for any required identifiers that are missing.

## Errors and limitations

The lookup fetches the slide's notes page internally, so you only need the slide's object id from list_slides. An empty string means the slide has no notes yet. Notes text is also searched by replace_text.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

- [Set speaker notes](./set-speaker-notes.md) — `set_speaker_notes`

## Technical details

- **Impact:** read-only
- **Group:** Speaker notes
- **Description source:** `get_speaker_notes` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
