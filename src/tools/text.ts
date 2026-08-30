import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import {
  fail,
  hexColorSchema,
  indexSchema,
  objectIdSchema,
  ok,
  presentationIdSchema,
  UPDATE,
  WRITE,
} from "./util.js";

export function registerTextTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "insert_text",
    {
      title: "Insert text",
      annotations: WRITE,
      description:
        "Inserts text into a shape or a table cell (batchUpdate insertText) at a 0-based character index (default 0 = the beginning). For a table cell pass row_index + column_index together. Text carries \\n for new paragraphs; the target must be a shape that can hold text or a table — images and lines cannot. To REPLACE what's already there use set_text instead; to fill an empty layout placeholder this works directly (find its object id via list_slides).",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        object_id: objectIdSchema("The shape or table object id (from list_slides)."),
        text: z.string().min(1).describe("The text to insert; use \\n for paragraph breaks."),
        insertion_index: indexSchema()
          .optional()
          .describe("0-based character index to insert at (default 0 — the start of the existing text)."),
        row_index: indexSchema().optional().describe("Table cell row (0-based; requires column_index)."),
        column_index: indexSchema().optional().describe("Table cell column (0-based; requires row_index)."),
      },
    },
    async ({ presentation_id, object_id, text, insertion_index, row_index, column_index }) => {
      try {
        return ok(
          await client.insertText({
            presentationId: presentation_id,
            objectId: object_id,
            text,
            insertionIndex: insertion_index,
            rowIndex: row_index,
            columnIndex: column_index,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_text",
    {
      title: "Set (replace) text",
      annotations: UPDATE,
      description:
        "Replaces the ENTIRE text of a shape or table cell: one atomic batch of deleteText(ALL) + insertText. If the target has no text yet the delete is skipped automatically, so it works on empty placeholders too. An empty text just clears the object. Replacing text drops per-character styling — restyle with update_text_style afterwards if needed. For a table cell pass row_index + column_index together.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        object_id: objectIdSchema("The shape or table object id (from list_slides)."),
        text: z.string().describe("The new full text; empty string clears the object. \\n starts a new paragraph."),
        row_index: indexSchema().optional().describe("Table cell row (0-based; requires column_index)."),
        column_index: indexSchema().optional().describe("Table cell column (0-based; requires row_index)."),
      },
    },
    async ({ presentation_id, object_id, text, row_index, column_index }) => {
      try {
        return ok(
          await client.setText({
            presentationId: presentation_id,
            objectId: object_id,
            text,
            rowIndex: row_index,
            columnIndex: column_index,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "replace_text",
    {
      title: "Find & replace text",
      annotations: UPDATE,
      description:
        "Finds and replaces every occurrence of a string across the whole deck — shapes and table cells on slides, and their speaker notes (batchUpdate replaceAllText). Scope it with page_object_ids to touch only specific slides. Matching is literal (no regex), case-sensitive by default (match_case=false to ignore case). Returns occurrencesChanged in the reply — 0 means nothing matched, check the exact wording with list_slides. The classic template flow: duplicate a template deck, then replace {{placeholders}}.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        find: z.string().min(1).describe("The literal text to find (no regex)."),
        replace: z.string().describe("The replacement text (empty string deletes the matches)."),
        match_case: z.boolean().optional().describe("Case-sensitive matching (default true)."),
        page_object_ids: z
          .array(z.string().min(1))
          .optional()
          .describe("Limit the replacement to these slides/pages (default: the whole presentation)."),
      },
    },
    async ({ presentation_id, find, replace, match_case, page_object_ids }) => {
      try {
        return ok(
          await client.replaceText({
            presentationId: presentation_id,
            find,
            replace,
            matchCase: match_case,
            pageObjectIds: page_object_ids,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_text_style",
    {
      title: "Style text",
      annotations: UPDATE,
      description:
        "Styles the text of a shape or table cell (batchUpdate updateTextStyle): bold, italic, underline, strikethrough, font_family (e.g. \"Roboto\"), font_size_pt, foreground_color (#RRGGBB) and link_url. Only the provided fields change (the field mask is computed automatically); at least one is required. By default the whole text is styled; pass start_index + end_index (0-based character offsets, end exclusive) to style a range — get the offsets from get_page's textElements. For a table cell add row_index + column_index.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        object_id: objectIdSchema("The shape or table object id whose text to style."),
        bold: z.boolean().optional().describe("Bold on/off."),
        italic: z.boolean().optional().describe("Italic on/off."),
        underline: z.boolean().optional().describe("Underline on/off."),
        strikethrough: z.boolean().optional().describe("Strikethrough on/off."),
        font_family: z.string().min(1).optional().describe('Font family, e.g. "Roboto" or "Playfair Display".'),
        font_size_pt: z.number().positive().optional().describe("Font size in points."),
        foreground_color: hexColorSchema().optional().describe("Text color as #RRGGBB."),
        link_url: z.string().url().optional().describe("Turns the styled range into a hyperlink."),
        start_index: indexSchema().optional().describe("Range start, 0-based character offset (requires end_index)."),
        end_index: indexSchema().optional().describe("Range end, exclusive (requires start_index)."),
        row_index: indexSchema().optional().describe("Table cell row (0-based; requires column_index)."),
        column_index: indexSchema().optional().describe("Table cell column (0-based; requires row_index)."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.updateTextStyle({
            presentationId: args.presentation_id,
            objectId: args.object_id,
            bold: args.bold,
            italic: args.italic,
            underline: args.underline,
            strikethrough: args.strikethrough,
            fontFamily: args.font_family,
            fontSizePt: args.font_size_pt,
            foregroundColor: args.foreground_color,
            linkUrl: args.link_url,
            startIndex: args.start_index,
            endIndex: args.end_index,
            rowIndex: args.row_index,
            columnIndex: args.column_index,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
