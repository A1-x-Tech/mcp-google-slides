import { test } from "node:test";
import assert from "node:assert/strict";
import { registerElementTools } from "./elements.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { ok: true };
    };
  const client = {
    createShape: make("createShape"),
    createImage: make("createImage"),
    replaceImage: make("replaceImage"),
    updateTransform: make("updateTransform"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerElementTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four element tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "create_image",
    "create_shape",
    "replace_image",
    "update_transform",
  ]);
});

test("create_shape maps geometry and initial text to normalized params", async () => {
  const { calls, tools } = harness();
  await tools.create_shape({
    presentation_id: "p",
    page_object_id: "s1",
    shape_type: "round_rectangle",
    text: "Hello",
    x_pt: 10,
    y_pt: 20,
    width_pt: 100,
    height_pt: 50,
    object_id: "shape_a",
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    pageObjectId: "s1",
    shapeType: "round_rectangle",
    text: "Hello",
    xPt: 10,
    yPt: 20,
    widthPt: 100,
    heightPt: 50,
    objectId: "shape_a",
  });
});

test("create_image passes exactly the source the caller chose", async () => {
  const { calls, tools } = harness();
  await tools.create_image({ presentation_id: "p", page_object_id: "s1", image_url: "https://x.example/a.png" });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.imageUrl, "https://x.example/a.png");
  assert.equal(params.imagePath, undefined);
  await tools.create_image({ presentation_id: "p", page_object_id: "s1", image_path: "/tmp/a.png" });
  const params2 = calls[1].params[0] as Record<string, unknown>;
  assert.equal(params2.imagePath, "/tmp/a.png");
});

test("replace_image forwards the target image and method", async () => {
  const { calls, tools } = harness();
  await tools.replace_image({
    presentation_id: "p",
    image_object_id: "img-1",
    image_url: "https://x.example/new.png",
    replace_method: "center_crop",
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    imageObjectId: "img-1",
    imageUrl: "https://x.example/new.png",
    imagePath: undefined,
    replaceMethod: "center_crop",
  });
});

test("update_transform forwards mode, translation and scale", async () => {
  const { calls, tools } = harness();
  await tools.update_transform({
    presentation_id: "p",
    object_id: "el",
    mode: "relative",
    translate_x_pt: 5,
    translate_y_pt: -5,
    scale_x: 2,
    scale_y: 0.5,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    objectId: "el",
    mode: "relative",
    translateXPt: 5,
    translateYPt: -5,
    scaleX: 2,
    scaleY: 0.5,
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "createImage" });
  const res = await tools.create_image({ presentation_id: "p", page_object_id: "s", image_url: "https://x/a.png" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
