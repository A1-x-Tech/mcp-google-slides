import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleSlidesClient } from "../client.js";
import {
  fail,
  newObjectIdSchema,
  objectIdSchema,
  ok,
  pointsSchema,
  presentationIdSchema,
  UPDATE,
  WRITE,
} from "./util.js";

export function registerElementTools(server: McpServer, client: GoogleSlidesClient): void {
  server.registerTool(
    "create_shape",
    {
      title: "Create a shape",
      annotations: WRITE,
      description:
        "Creates a shape on a slide (batchUpdate createShape), optionally with its initial text in the same atomic batch. Types: text_box, rectangle, round_rectangle, ellipse, diamond, triangle, right_arrow, left_arrow, up_arrow, down_arrow, star, heart, cloud, callout — the API's other ~130 ShapeTypes go through batch_update. Position/size are in points ((0,0) is top-left; a default 16:9 slide is 720x405 pt); omitted geometry defaults to 300x80 pt at (50,50). Returns the shape's objectId in the reply. Fill/outline/shadow are not parameters here — style via batch_update updateShapeProperties; text styling via update_text_style.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        page_object_id: objectIdSchema("The slide's object id to place the shape on (from list_slides)."),
        shape_type: z
          .enum([
            "text_box",
            "rectangle",
            "round_rectangle",
            "ellipse",
            "diamond",
            "triangle",
            "right_arrow",
            "left_arrow",
            "up_arrow",
            "down_arrow",
            "star",
            "heart",
            "cloud",
            "callout",
          ])
          .describe("The shape type."),
        text: z.string().optional().describe("Initial text, inserted in the same atomic batch."),
        x_pt: pointsSchema().optional().describe("Left edge in points (requires y_pt; default 50)."),
        y_pt: pointsSchema().optional().describe("Top edge in points (requires x_pt; default 50)."),
        width_pt: pointsSchema().optional().describe("Width in points (requires height_pt; default 300)."),
        height_pt: pointsSchema().optional().describe("Height in points (requires width_pt; default 80)."),
        object_id: newObjectIdSchema()
          .optional()
          .describe("Optional custom object id (5-50 chars of [a-zA-Z0-9_-:]); auto-generated when omitted."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.createShape({
            presentationId: args.presentation_id,
            pageObjectId: args.page_object_id,
            shapeType: args.shape_type,
            text: args.text,
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
    "create_image",
    {
      title: "Insert an image",
      annotations: WRITE,
      description:
        "Inserts an image on a slide (batchUpdate createImage) from EITHER image_url — a public https URL Google's servers can fetch (validated: https-only, no private/local hosts, ≤2 kB; the image itself must be PNG/JPEG/GIF, ≤50 MB, ≤25 megapixels) — OR image_path, a local file that is checked by magic bytes, uploaded to Drive, shared by link for the fetch and DELETED from Drive right after (Slides stores its own copy, so the temp file is disposable; the result reports the cleanup). Omitted size keeps the image's native proportions fitted to the page; position/size are in points. Returns the image objectId in the reply.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        page_object_id: objectIdSchema("The slide's object id to place the image on (from list_slides)."),
        image_url: z
          .string()
          .url()
          .optional()
          .describe("Public https URL of a PNG/JPEG/GIF (exactly one of image_url / image_path)."),
        image_path: z
          .string()
          .min(1)
          .optional()
          .describe("Absolute local path of a PNG/JPEG/GIF file (exactly one of image_url / image_path)."),
        x_pt: pointsSchema().optional().describe("Left edge in points (requires y_pt)."),
        y_pt: pointsSchema().optional().describe("Top edge in points (requires x_pt)."),
        width_pt: pointsSchema().optional().describe("Width in points (requires height_pt)."),
        height_pt: pointsSchema().optional().describe("Height in points (requires width_pt)."),
        object_id: newObjectIdSchema().optional().describe("Optional custom object id for the new image."),
      },
    },
    async (args) => {
      try {
        return ok(
          await client.createImage({
            presentationId: args.presentation_id,
            pageObjectId: args.page_object_id,
            imageUrl: args.image_url,
            imagePath: args.image_path,
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
    "replace_image",
    {
      title: "Replace an image",
      annotations: UPDATE,
      description:
        "Swaps the bitmap of an existing image element while keeping its frame, position and effects (batchUpdate replaceImage). The new picture comes from image_url or image_path with exactly the same validation/upload/cleanup rules as create_image. replace_method: center_inside (default — scales to fit inside the frame, keeping aspect) or center_crop (fills the frame, cropping the overflow).",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        image_object_id: objectIdSchema("The existing image element's object id (type \"image\" in list_slides)."),
        image_url: z
          .string()
          .url()
          .optional()
          .describe("Public https URL of the new PNG/JPEG/GIF (exactly one of image_url / image_path)."),
        image_path: z
          .string()
          .min(1)
          .optional()
          .describe("Absolute local path of the new image (exactly one of image_url / image_path)."),
        replace_method: z
          .enum(["center_inside", "center_crop"])
          .optional()
          .describe("How the new image fills the old frame (default center_inside)."),
      },
    },
    async ({ presentation_id, image_object_id, image_url, image_path, replace_method }) => {
      try {
        return ok(
          await client.replaceImage({
            presentationId: presentation_id,
            imageObjectId: image_object_id,
            imageUrl: image_url,
            imagePath: image_path,
            replaceMethod: replace_method,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "update_transform",
    {
      title: "Move / scale an element",
      annotations: UPDATE,
      description:
        "Moves and/or scales a page element (batchUpdate updatePageElementTransform). mode=absolute REPLACES the element's whole transform: translate_x_pt/translate_y_pt become the new top-left-ish origin and omitted scales default to 1 — NOT to the current values, so an absolute move of a scaled element also resets its scale unless you resend it. mode=relative multiplies onto the existing transform: translate shifts by the given points, scale 2 doubles the current size (scaling happens around the origin, which also shifts the element — for a simple move prefer relative translate only). Element geometry to reason from is in get_page.",
      inputSchema: {
        presentation_id: presentationIdSchema(),
        object_id: objectIdSchema("The page element's object id (from list_slides)."),
        mode: z
          .enum(["absolute", "relative"])
          .describe("absolute = replace the whole transform; relative = multiply onto the current one."),
        translate_x_pt: pointsSchema().optional().describe("Horizontal translation in points (default 0)."),
        translate_y_pt: pointsSchema().optional().describe("Vertical translation in points (default 0)."),
        scale_x: z.number().finite().optional().describe("Horizontal scale factor (default 1)."),
        scale_y: z.number().finite().optional().describe("Vertical scale factor (default 1)."),
      },
    },
    async ({ presentation_id, object_id, mode, translate_x_pt, translate_y_pt, scale_x, scale_y }) => {
      try {
        return ok(
          await client.updateTransform({
            presentationId: presentation_id,
            objectId: object_id,
            mode,
            translateXPt: translate_x_pt,
            translateYPt: translate_y_pt,
            scaleX: scale_x,
            scaleY: scale_y,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
