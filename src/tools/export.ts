import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import { fail, objectIdSchema, ok, presentationIdSchema, READ_ONLY } from "./util.js";

export function registerExportTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "get_thumbnail",
    {
      title: "Get a slide thumbnail",
      annotations: READ_ONLY,
      description:
        "Renders one page (slide, layout or master) as a PNG. Without output_path it returns contentUrl + width/height — the URL is short-lived (~30 minutes) and served from googleusercontent.com. With output_path the PNG is downloaded and saved to that local file instead (the download is restricted to Google's image hosts). size: large (1600px, default), medium (800px) or small (200px). This is the way to SEE what a slide actually looks like — the JSON never shows rendering. Counts as an expensive read in the API quota.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        page_object_id: objectIdSchema("The slide's object id to render (from list_slides)."),
        size: z
          .enum(["large", "medium", "small"])
          .optional()
          .describe("Thumbnail width: large=1600px (default), medium=800px, small=200px."),
        output_path: z
          .string()
          .min(1)
          .optional()
          .describe("Local file path to save the PNG to; omitted = return the short-lived contentUrl."),
      },
    },
    async ({ presentation_id, page_object_id, size, output_path }) => {
      try {
        return ok(
          await client.getThumbnail({
            presentationId: presentation_id,
            pageObjectId: page_object_id,
            size,
            outputPath: output_path,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "export_presentation",
    {
      title: "Export the presentation",
      annotations: READ_ONLY,
      description:
        "Downloads the whole presentation as pdf, pptx, odp or txt (txt = all text incl. speaker notes) and saves it to output_path, overwriting an existing file. Served by the Drive export endpoint internally, which caps exports at 10 MB — a bigger deck fails with an export-size error (split it or use the Slides UI). Requires a Drive scope on the OAuth token (drive.readonly is enough; presentations-only gets a 403). Returns saved_to, bytes and mime_type; nothing in the presentation changes.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        format: z.enum(["pdf", "pptx", "odp", "txt"]).describe("The export format."),
        output_path: z
          .string()
          .min(1)
          .describe("Local file path to write, e.g. /tmp/deck.pdf — existing files are overwritten."),
      },
    },
    async ({ presentation_id, format, output_path }) => {
      try {
        return ok(await client.exportPresentation(presentation_id, format, output_path));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
