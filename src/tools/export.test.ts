import { test } from "node:test";
import assert from "node:assert/strict";
import { registerExportTools } from "./export.js";

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
    getThumbnail: make("getThumbnail"),
    exportPresentation: make("exportPresentation"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerExportTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two export tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["export_presentation", "get_thumbnail"]);
});

test("get_thumbnail maps size and optional output path", async () => {
  const { calls, tools } = harness();
  await tools.get_thumbnail({ presentation_id: "p", page_object_id: "s1", size: "small", output_path: "/tmp/a.png" });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    pageObjectId: "s1",
    size: "small",
    outputPath: "/tmp/a.png",
  });
  await tools.get_thumbnail({ presentation_id: "p", page_object_id: "s1" });
  assert.deepEqual(calls[1].params[0], {
    presentationId: "p",
    pageObjectId: "s1",
    size: undefined,
    outputPath: undefined,
  });
});

test("export_presentation forwards format and output path positionally", async () => {
  const { calls, tools } = harness();
  await tools.export_presentation({ presentation_id: "p", format: "pdf", output_path: "/tmp/deck.pdf" });
  assert.deepEqual(calls[0], { method: "exportPresentation", params: ["p", "pdf", "/tmp/deck.pdf"] });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "exportPresentation" });
  const res = await tools.export_presentation({ presentation_id: "p", format: "pdf", output_path: "/tmp/x.pdf" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
