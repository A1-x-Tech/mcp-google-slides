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
  presentationIdSchema,
  READ_ONLY,
  WRITE,
} from "./util.js";

export function registerSlideTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "add_slide",
    {
      title: "Add a slide",
      annotations: WRITE,
      description:
        "Adds a slide (batchUpdate createSlide) and returns the new slide's objectId in the reply. Pick the look with either predefined_layout (BLANK, TITLE, TITLE_AND_BODY, SECTION_HEADER, ...) or layout_object_id from list_layouts — not both; with neither the slide copies the layout of the current last slide. insertion_index is the 0-based position (omitted = append at the end). Placeholders inherited from the layout arrive empty — find their object ids via list_slides, then fill them with set_text.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        insertion_index: indexSchema()
          .optional()
          .describe("0-based position for the new slide; omitted = append at the end."),
        predefined_layout: z
          .enum([
            "BLANK",
            "CAPTION_ONLY",
            "TITLE",
            "TITLE_AND_BODY",
            "TITLE_AND_TWO_COLUMNS",
            "TITLE_ONLY",
            "SECTION_HEADER",
            "SECTION_TITLE_AND_DESCRIPTION",
            "ONE_COLUMN_TEXT",
            "MAIN_POINT",
            "BIG_NUMBER",
          ])
          .optional()
          .describe("A predefined layout; the theme's actual layouts may support only a subset."),
        layout_object_id: z
          .string()
          .min(1)
          .optional()
          .describe("A concrete layout's object id from list_layouts (alternative to predefined_layout)."),
        object_id: newObjectIdSchema()
          .optional()
          .describe("Optional custom object id for the new slide (5-50 chars of [a-zA-Z0-9_-:])."),
      },
    },
    async ({ presentation_id, insertion_index, predefined_layout, layout_object_id, object_id }) => {
      try {
        return ok(
          await client.addSlide({
            presentationId: presentation_id,
            insertionIndex: insertion_index,
            predefinedLayout: predefined_layout,
            layoutObjectId: layout_object_id,
            objectId: object_id,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "duplicate_slide",
    {
      title: "Duplicate a slide",
      annotations: WRITE,
      description:
        "Duplicates a slide (batchUpdate duplicateObject) — the copy, with all its elements and speaker notes, lands immediately after the original and its new objectId comes back in the reply. Works on any page element id too (the copy lands on the same slide, slightly offset). Move the copy with move_slides afterwards if needed.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        slide_object_id: objectIdSchema("The object id of the slide (or page element) to duplicate."),
      },
    },
    async ({ presentation_id, slide_object_id }) => {
      try {
        return ok(await client.duplicateSlide(presentation_id, slide_object_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "move_slides",
    {
      title: "Move slides",
      annotations: WRITE,
      description:
        "Moves one or more slides to a new position (batchUpdate updateSlidesPosition). slide_object_ids must appear in their current deck order with no duplicates; insertion_index is the 0-based position BEFORE the move is applied (moving a slide down: index counts with the slide still in its old place). Use list_slides to see the current order first.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        slide_object_ids: z
          .array(z.string().min(1))
          .min(1)
          .describe("The slides to move, listed in their current presentation order."),
        insertion_index: indexSchema().describe(
          "0-based target position, evaluated before the slides are removed from their old places.",
        ),
      },
    },
    async ({ presentation_id, slide_object_ids, insertion_index }) => {
      try {
        return ok(await client.moveSlides(presentation_id, slide_object_ids, insertion_index));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "delete_object",
    {
      title: "Delete a slide or element",
      annotations: DESTRUCTIVE,
      description:
        "Deletes a slide or a page element (shape, image, table, video, line, group) by object id — batchUpdate deleteObject. Deleting a slide removes all its elements and speaker notes; deleting a group removes its children. There is no undo through the API (version history lives in the Slides UI). It cannot delete the whole presentation — that is a Drive file operation outside this server.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        object_id: objectIdSchema("The object id of the slide or page element to delete (from list_slides)."),
      },
    },
    async ({ presentation_id, object_id }) => {
      try {
        return ok(await client.deleteObject(presentation_id, object_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_layouts",
    {
      title: "List layouts and masters",
      annotations: READ_ONLY,
      description:
        "Lists the presentation's theme building blocks: layouts[] (objectId, name like TITLE_AND_BODY, displayName, masterObjectId), masters[] and the notesMasterObjectId. Layout object ids feed add_slide's layout_object_id; the Slides API cannot import a new theme or change the master set — themes are chosen in the UI, this tool only reads what the deck already has.",
      inputSchema: { presentation_id: presentationIdSchema() },
    },
    async ({ presentation_id }) => {
      try {
        return ok(await client.listLayouts(presentation_id));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
