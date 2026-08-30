import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import { DESTRUCTIVE, fail, objectIdSchema, ok, presentationIdSchema, READ_ONLY, WRITE } from "./util.js";

export function registerPresentationTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "create_presentation",
    {
      title: "Create a presentation",
      annotations: WRITE,
      description:
        "Creates a new Google Slides presentation and returns it (presentationId, revisionId, pageSize, the initial title slide with its object ids, layouts and masters). The API honors only the title at creation — add slides with add_slide, content with the text/shape/table/image tools. The new deck starts with one title slide and belongs to the authorized user's Drive. Note: this server cannot delete a presentation; removing the file is a Drive operation outside its scope.",
      inputSchema: {
        title: z.string().min(1).describe("The presentation title (also the Drive file name)."),
      },
    },
    async ({ title }) => {
      try {
        return ok(await client.createPresentation(title));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_presentation",
    {
      title: "Get a presentation",
      annotations: READ_ONLY,
      description:
        "Returns the raw presentation JSON: slides[] with every page element (shapes, text runs, tables, images), layouts[], masters[], notesMaster, pageSize (EMU: 1 pt = 12700 EMU) and revisionId. WARNING: a full deck is often hundreds of kilobytes — prefer list_slides for an inventory, and pass fields (a Google fields mask, e.g. \"slides(objectId,pageElements(objectId,shape(text)))\") to trim this response when you need raw detail.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        fields: z
          .string()
          .optional()
          .describe('Optional Google fields mask to trim the response, e.g. "slides(objectId),pageSize".'),
      },
    },
    async ({ presentation_id, fields }) => {
      try {
        return ok(await client.getPresentation(presentation_id, fields));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_slides",
    {
      title: "List slides (compact inventory)",
      annotations: READ_ONLY,
      description:
        "Compact inventory of the deck — the read to start from: presentationId, title, revisionId, pageSizePt, slideCount and per slide its 0-based index, objectId, layoutObjectId, speakerNotesObjectId and elements[] with each element's objectId, type (shape type / table RxC / image / video / line / group), placeholder role and visible text (truncated to 160 chars). All mutation tools address these object ids, so call this before editing; per-element geometry and full text need get_presentation or get_page.",
      inputSchema: { presentation_id: presentationIdSchema() },
    },
    async ({ presentation_id }) => {
      try {
        return ok(await client.listSlides(presentation_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get one page",
      annotations: READ_ONLY,
      description:
        "Returns one page in full by its object id — works for slides, layouts, masters and notes pages alike. For a slide the response includes slideProperties.notesPage (the speaker-notes page) and every pageElement with its size, transform (EMU: 1 pt = 12700 EMU) and complete text. Use it when list_slides' summary is not enough for one page but the whole deck via get_presentation would be too much.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        page_object_id: objectIdSchema(
          "The page's object id — a slide/layout/master/notes-page id from list_slides or get_presentation.",
        ),
      },
    },
    async ({ presentation_id, page_object_id }) => {
      try {
        return ok(await client.getPage(presentation_id, page_object_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "batch_update",
    {
      title: "Raw batchUpdate",
      // Arbitrary requests include deleteObject — annotate for the worst case.
      annotations: DESTRUCTIVE,
      description:
        'Sends raw Slides API batchUpdate requests for anything the typed tools don\'t cover: updateShapeProperties (fill, outline, shadow), updatePageProperties (slide background), updateParagraphStyle, createParagraphBullets, updateTableCellProperties, mergeTableCells, createVideo, createLine, groupObjects, updateSlideProperties and the rest of the request union. requests is the API\'s requests[] array verbatim, e.g. [{"updateShapeProperties":{"objectId":"...","shapeProperties":{...},"fields":"shapeFill"}}]. The batch is atomic: one invalid request rejects the whole batch and nothing is applied. Lengths/coordinates take {"magnitude":N,"unit":"PT"}; wire enums are UPPER_CASE.',
      inputSchema: {
        presentation_id: presentationIdSchema(),
        requests: z
          .array(z.record(z.any()))
          .min(1)
          .describe("The Slides API batchUpdate requests[] array, verbatim wire format."),
      },
    },
    async ({ presentation_id, requests }) => {
      try {
        return ok(await client.batchUpdate(presentation_id, requests));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
