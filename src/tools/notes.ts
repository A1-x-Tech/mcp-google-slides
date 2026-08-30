import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import { fail, objectIdSchema, ok, presentationIdSchema, READ_ONLY, UPDATE } from "./util.js";

export function registerNoteTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "get_speaker_notes",
    {
      title: "Get speaker notes",
      annotations: READ_ONLY,
      description:
        "Returns a slide's speaker notes as plain text, plus the speakerNotesObjectId (the text shape on the slide's hidden notes page). The lookup fetches the slide's notes page internally, so you only need the slide's object id from list_slides. An empty string means the slide has no notes yet. Notes text is also searched by replace_text.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        slide_object_id: objectIdSchema("The slide's object id (from list_slides) — not the notes page id."),
      },
    },
    async ({ presentation_id, slide_object_id }) => {
      try {
        return ok(await client.getSpeakerNotes(presentation_id, slide_object_id));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "set_speaker_notes",
    {
      title: "Set speaker notes",
      annotations: UPDATE,
      description:
        "Replaces a slide's speaker notes with the given text (empty string clears them). The tool resolves the slide's speakerNotesObjectId internally and rewrites that shape atomically — you pass the slide's object id, not the notes shape id. Notes are visible in the presenter view and exported by format txt; use \\n for paragraphs.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        slide_object_id: objectIdSchema("The slide's object id (from list_slides) — not the notes page id."),
        text: z.string().describe("The new speaker notes; empty string clears them. \\n starts a new paragraph."),
      },
    },
    async ({ presentation_id, slide_object_id, text }) => {
      try {
        return ok(await client.setSpeakerNotes(presentation_id, slide_object_id, text));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
