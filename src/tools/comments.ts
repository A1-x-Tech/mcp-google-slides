import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import { DESTRUCTIVE, fail, ok, presentationIdSchema } from "./util.js";

export function registerCommentTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "manage_comments",
    {
      title: "Manage comments",
      // One tool covers list/get/create/reply/delete; delete removes state, so
      // the whole tool carries the destructive, non-idempotent hints.
      annotations: DESTRUCTIVE,
      description:
        "Comment threads on the presentation file (served by the Drive API internally — scoped to this one file, no generic Drive access). action=list returns comments with replies and resolved status (pageSize/page_token to paginate, include_deleted for tombstones); get needs comment_id; create needs content and starts a new unanchored thread (the API cannot anchor a new comment to a specific slide or shape); reply needs comment_id + content and/or resolve=true (resolve closes the thread); delete needs comment_id and permanently removes the thread with all replies. Requires a Drive scope on the OAuth token (https://www.googleapis.com/auth/drive) — a presentations-only token gets a 403 here.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        action: z
          .enum(["list", "get", "create", "reply", "delete"])
          .describe("What to do with the presentation's comments."),
        comment_id: z.string().min(1).optional().describe("get/reply/delete: the comment id from list."),
        content: z.string().min(1).optional().describe("create/reply: the comment text (plain text)."),
        resolve: z.boolean().optional().describe("reply only: also mark the whole thread resolved."),
        page_size: z.number().int().min(1).max(100).optional().describe("list: comments per page (1-100)."),
        page_token: z.string().optional().describe("list: nextPageToken from the previous page."),
        include_deleted: z.boolean().optional().describe("list: include deleted comments as tombstones."),
      },
    },
    async ({ presentation_id, action, comment_id, content, resolve, page_size, page_token, include_deleted }) => {
      try {
        return ok(
          await client.manageComments({
            presentationId: presentation_id,
            action,
            commentId: comment_id,
            content,
            resolve,
            pageSize: page_size,
            pageToken: page_token,
            includeDeleted: include_deleted,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
