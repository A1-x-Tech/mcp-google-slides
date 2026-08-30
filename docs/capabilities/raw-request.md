# Google Slides: Raw Google Slides API call — MCP tool

**Google Slides MCP tool:** Escape hatch to call any Google Slides API v1 path directly, for requests even batch_update doesn't cover — e.g.

Technical name: `raw_request`

## What task it solves

> I want to call a Slides API endpoint directly.

Escape hatch to call any Google Slides API v1 path directly, for requests even batch_update doesn't cover — e.g.

## When to use it

Use this capability when you need “Raw Google Slides API call” without doing the same work manually in the Google Slides interface. It runs only when an AI client calls it.

## What to provide

- `path` — **required**. API path relative to https://slides.googleapis.com, e.g. "v1/presentations/<id>:batchUpdate".
- `method` — **optional**. HTTP method (the Slides API uses only these two). Defaults to GET.
- `body` — **optional**. JSON request body (POST only).

## What it returns

Returns compact JSON from the upstream API or a clear MCP tool error. The exact fields depend on the operation and are documented in the technical reference.

## What changes in Google Slides

The source marks the entire “Raw Google Slides API call” call as destructive: it can permanently remove or overwrite existing content. Review the parameters and reversibility before calling it.

## Example request

> Raw Google Slides API call in Google Slides. Ask for any required identifiers that are missing. Show me the exact change and wait for confirmation first.

## Errors and limitations

GET "v1/presentations/<id>/pages/<pageId>" with a custom fields mask in the query string, or a POST with a body shaped differently from the typed tools. The Slides API only has GET and POST endpoints; the path is relative to https://slides.googleapis.com and may carry a query string. The Bearer token is added automatically; a path resolving to a foreign origin is rejected. Drive endpoints (comments, export) are NOT reachable here — use manage_comments / export_presentation.

Access also depends on token permissions, quotas, and upstream API limits.

## Related MCP tools

There are no other dedicated tools in this group.

## Technical details

- **Impact:** destructive operation
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
