import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTextTools } from "./text.js";

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
    insertText: make("insertText"),
    setText: make("setText"),
    replaceText: make("replaceText"),
    updateTextStyle: make("updateTextStyle"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTextTools(server as never, client as never);
  return { calls, tools };
}

test("registers the four text tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["insert_text", "replace_text", "set_text", "update_text_style"]);
});

test("insert_text and set_text map cell coordinates to normalized params", async () => {
  const { calls, tools } = harness();
  await tools.insert_text({
    presentation_id: "p",
    object_id: "tbl",
    text: "Hi",
    insertion_index: 4,
    row_index: 1,
    column_index: 2,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    objectId: "tbl",
    text: "Hi",
    insertionIndex: 4,
    rowIndex: 1,
    columnIndex: 2,
  });
  await tools.set_text({ presentation_id: "p", object_id: "box", text: "" });
  assert.deepEqual(calls[1].params[0], {
    presentationId: "p",
    objectId: "box",
    text: "",
    rowIndex: undefined,
    columnIndex: undefined,
  });
});

test("replace_text forwards find/replace with scoping options", async () => {
  const { calls, tools } = harness();
  await tools.replace_text({
    presentation_id: "p",
    find: "{{x}}",
    replace: "42",
    match_case: false,
    page_object_ids: ["s1"],
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    find: "{{x}}",
    replace: "42",
    matchCase: false,
    pageObjectIds: ["s1"],
  });
});

test("update_text_style maps every style field to camelCase", async () => {
  const { calls, tools } = harness();
  await tools.update_text_style({
    presentation_id: "p",
    object_id: "box",
    bold: true,
    italic: false,
    font_family: "Roboto",
    font_size_pt: 18,
    foreground_color: "#00FF00",
    link_url: "https://example.com",
    start_index: 0,
    end_index: 4,
    row_index: 1,
    column_index: 1,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    objectId: "box",
    bold: true,
    italic: false,
    underline: undefined,
    strikethrough: undefined,
    fontFamily: "Roboto",
    fontSizePt: 18,
    foregroundColor: "#00FF00",
    linkUrl: "https://example.com",
    startIndex: 0,
    endIndex: 4,
    rowIndex: 1,
    columnIndex: 1,
  });
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "setText" });
  const res = await tools.set_text({ presentation_id: "p", object_id: "b", text: "x" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
