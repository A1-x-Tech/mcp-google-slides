import { test } from "node:test";
import assert from "node:assert/strict";
import { registerPresentationTools } from "./presentations.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Fake server + fake client so the tool handlers run without network. */
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
    createPresentation: make("createPresentation"),
    getPresentation: make("getPresentation"),
    listSlides: make("listSlides"),
    getPage: make("getPage"),
    batchUpdate: make("batchUpdate"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerPresentationTools(server as never, client as never);
  return { calls, tools };
}

test("registers the five presentation tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), [
    "batch_update",
    "create_presentation",
    "get_page",
    "get_presentation",
    "list_slides",
  ]);
});

test("create_presentation forwards the title", async () => {
  const { calls, tools } = harness();
  await tools.create_presentation({ title: "Deck" });
  assert.deepEqual(calls[0], { method: "createPresentation", params: ["Deck"] });
});

test("get_presentation passes the id and the optional fields mask", async () => {
  const { calls, tools } = harness();
  await tools.get_presentation({ presentation_id: "p1" });
  assert.deepEqual(calls[0].params, ["p1", undefined]);
  await tools.get_presentation({ presentation_id: "p1", fields: "slides(objectId)" });
  assert.deepEqual(calls[1].params, ["p1", "slides(objectId)"]);
});

test("list_slides and get_page pass their ids through", async () => {
  const { calls, tools } = harness();
  await tools.list_slides({ presentation_id: "p1" });
  assert.deepEqual(calls[0], { method: "listSlides", params: ["p1"] });
  await tools.get_page({ presentation_id: "p1", page_object_id: "s2" });
  assert.deepEqual(calls[1], { method: "getPage", params: ["p1", "s2"] });
});

test("batch_update forwards the raw requests array verbatim", async () => {
  const { calls, tools } = harness();
  const requests = [{ deleteObject: { objectId: "x" } }, { createSlide: {} }];
  await tools.batch_update({ presentation_id: "p1", requests });
  assert.deepEqual(calls[0], { method: "batchUpdate", params: ["p1", requests] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "listSlides" });
  const res = await tools.list_slides({ presentation_id: "p1" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
