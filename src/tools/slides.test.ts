import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSlideTools } from "./slides.js";

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
    addSlide: make("addSlide"),
    duplicateSlide: make("duplicateSlide"),
    moveSlides: make("moveSlides"),
    deleteObject: make("deleteObject"),
    listLayouts: make("listLayouts"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSlideTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five slide tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "add_slide",
    "delete_object",
    "duplicate_slide",
    "list_layouts",
    "move_slides",
  ]);
});

test("add_slide maps snake_case inputs to the client's normalized params", async () => {
  const { calls, tools } = harness();
  await tools.add_slide({
    presentation_id: "p",
    insertion_index: 1,
    predefined_layout: "TITLE_AND_BODY",
    object_id: "slide_custom",
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    insertionIndex: 1,
    predefinedLayout: "TITLE_AND_BODY",
    layoutObjectId: undefined,
    objectId: "slide_custom",
  });
  await tools.add_slide({ presentation_id: "p", layout_object_id: "layout-3" });
  assert.equal((calls[1].params[0] as Record<string, unknown>).layoutObjectId, "layout-3");
});

test("duplicate_slide, move_slides and delete_object forward ids and indexes", async () => {
  const { calls, tools } = harness();
  await tools.duplicate_slide({ presentation_id: "p", slide_object_id: "s1" });
  assert.deepEqual(calls[0], { method: "duplicateSlide", params: ["p", "s1"] });
  await tools.move_slides({ presentation_id: "p", slide_object_ids: ["s1", "s2"], insertion_index: 0 });
  assert.deepEqual(calls[1], { method: "moveSlides", params: ["p", ["s1", "s2"], 0] });
  await tools.delete_object({ presentation_id: "p", object_id: "shape-1" });
  assert.deepEqual(calls[2], { method: "deleteObject", params: ["p", "shape-1"] });
});

test("list_layouts passes the presentation id", async () => {
  const { calls, tools } = harness();
  await tools.list_layouts({ presentation_id: "p" });
  assert.deepEqual(calls[0], { method: "listLayouts", params: ["p"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "deleteObject" });
  const res = await tools.delete_object({ presentation_id: "p", object_id: "s" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
