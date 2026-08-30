# Google Slides: Manage comments — MCP tool

**Google Slides MCP tool:** Comment threads on the presentation file (served by the Drive API internally — scoped to this one file, no generic Drive access). action=list returns comments with replies and resolved status (pageSize/page_token to paginate, include_deleted for tombstones); get needs comment_id; create needs content and starts a new unanchored thread (the API cannot anchor a new comment to a specific slide or shape); reply needs comment_id + content and/or resolve=true (resolve closes the thread); delete needs comment_id and permanently removes the thread with all replies.

Technical name: `manage_comments`

## What task it solves

> I want to work with comments on the presentation.

Comment threads on the presentation file (served by the Drive API internally — scoped to this one file, no generic Drive access). action=list returns comments with replies and resolved status (pageSize/page_token to paginate, include_deleted for tombstones); get needs comment_id; create needs content and starts a new unanchored thread (the API cannot anchor a new comment to a specific slide or shape); reply needs comment_id + content and/or resolve=true (resolve closes the thread); delete needs comment_id and permanently removes the thread with all replies.

## When to use it

Use this capability when you need “Manage comments” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `presentation_id` — **required**. The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.
- `action` — **required**. What to do with the presentation's comments.
- `comment_id` — **optional**. get/reply/delete: the comment id from list.
- `content` — **optional**. create/reply: the comment text (plain text).
- `resolve` — **optional**. reply only: also mark the whole thread resolved.
- `page_size` — **optional**. list: comments per page (1-100).
- `page_token` — **optional**. list: nextPageToken from the previous page.
- `include_deleted` — **optional**. list: include deleted comments as tombstones.

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Manage comments” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Manage comments in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

Requires a Drive scope on the OAuth token (https://www.googleapis.com/auth/drive) — a presentations-only token gets a 403 here.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

There are no other dedicated tools in this group.

## Technical details

- **Impact:** destructive operation
- **Group:** Comments
- **Description source:** `manage_comments` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
