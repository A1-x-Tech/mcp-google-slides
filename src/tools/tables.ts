import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import {
  DESTRUCTIVE,
  fail,
  indexSchema,
  newObjectIdSchema,
  objectIdSchema,
  ok,
  pointsSchema,
  presentationIdSchema,
  WRITE,
} from "./util.js";

export function registerTableTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "create_table",
    {
      title: "Create a table",
      annotations: WRITE,
      description:
        "Creates an empty rows x columns table on a slide (batchUpdate createTable) and returns its objectId in the reply. Fill cells with set_text / insert_text using row_index + column_index (0-based); restructure later with edit_table. Position/size are in points; omitted geometry lets the API pick a centered default. Cell styling (borders, background) goes through batch_update updateTableCellProperties.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        page_object_id: objectIdSchema("The slide's object id to place the table on (from list_slides)."),
        rows: z.number().int().min(1).max(20).describe("Row count (the API allows at most 20 rows at creation)."),
        columns: z
          .number()
          .int()
          .min(1)
          .max(20)
          .describe("Column count (the API allows at most 20 columns at creation)."),
        x_pt: pointsSchema().optional().describe("Left edge in points (requires y_pt)."),
        y_pt: pointsSchema().optional().describe("Top edge in points (requires x_pt)."),
        width_pt: pointsSchema().optional().describe("Width in points (requires height_pt)."),
        height_pt: pointsSchema().optional().describe("Height in points (requires width_pt)."),
        object_id: newObjectIdSchema().optional().describe("Optional custom object id for the new table."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.createTable({
            presentationId: args.presentation_id,
            pageObjectId: args.page_object_id,
            rows: args.rows,
            columns: args.columns,
            xPt: args.x_pt,
            yPt: args.y_pt,
            widthPt: args.width_pt,
            heightPt: args.height_pt,
            objectId: args.object_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "edit_table",
    {
      title: "Edit table structure",
      // insert_* only adds, but delete_row/delete_column remove content — the
      // whole tool carries the worst case's hints.
      annotations: DESTRUCTIVE,
      description:
        "Restructures an existing table in one call. action=insert_rows needs row_index (+optional below, default true, and count 1-20); insert_columns needs column_index (+optional right, default true, and count); delete_row needs row_index and delete_column needs column_index — deletion permanently discards the cells' content, and the remaining rows/columns shift so indexes change between successive edits (re-check with list_slides). Cell TEXT is written with set_text/insert_text (row_index + column_index), not here.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        table_object_id: objectIdSchema('The table\'s object id (type "table" in list_slides).'),
        action: z
          .enum(["insert_rows", "insert_columns", "delete_row", "delete_column"])
          .describe("The structural edit to apply."),
        row_index: indexSchema()
          .optional()
          .describe("Reference row, 0-based (insert_rows / delete_row)."),
        column_index: indexSchema()
          .optional()
          .describe("Reference column, 0-based (insert_columns / delete_column)."),
        count: z.number().int().min(1).max(20).optional().describe("How many rows/columns to insert (default 1)."),
        below: z
          .boolean()
          .optional()
          .describe("insert_rows: insert below the reference row (default true; false = above)."),
        right: z
          .boolean()
          .optional()
          .describe("insert_columns: insert to the right of the reference column (default true; false = left)."),
      },
    },
    async ({ presentation_id, table_object_id, action, row_index, column_index, count, below, right }) => {
      try {
        return ok(
          await client.editTable({
            presentationId: presentation_id,
            tableObjectId: table_object_id,
            action,
            rowIndex: row_index,
            columnIndex: column_index,
            count,
            below,
            right,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
