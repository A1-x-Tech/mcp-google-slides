import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient, HttpMethod } from "../client.js";
import { DESTRUCTIVE, fail, ok } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Google Slides API call",
      // Full API surface incl. arbitrary batchUpdate — annotate for the worst
      // case a call can do, not the average.
      annotations: DESTRUCTIVE,
      description:
        'Escape hatch to call any Google Slides API v1 path directly, for requests even batch_update doesn\'t cover — e.g. GET "v1/presentations/<id>/pages/<pageId>" with a custom fields mask in the query string, or a POST with a body shaped differently from the typed tools. The Slides API only has GET and POST endpoints; the path is relative to https://slides.googleapis.com and may carry a query string. The Bearer token is added automatically; a path resolving to a foreign origin is rejected. Drive endpoints (comments, export) are NOT reachable here — use manage_comments / export_presentation.',
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe('API path relative to https://slides.googleapis.com, e.g. "v1/presentations/<id>:batchUpdate".'),
        method: z
          .enum(["GET", "POST"])
          .optional()
          .describe("HTTP method (the Slides API uses only these two). Defaults to GET."),
        body: z.record(z.any()).optional().describe("JSON request body (POST only)."),
      },
    },
    async ({ path, method, body }) => {
      try {
        const m = (method ?? "GET") as HttpMethod;
        return ok(await client.request(m, path, body));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
