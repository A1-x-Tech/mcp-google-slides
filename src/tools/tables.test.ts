import { test } from "node:test";
import assert from "node:assert/strict";
import { registerTableTools } from "./tables.js";

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
    createTable: make("createTable"),
    editTable: make("editTable"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerTableTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two table tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["create_table", "edit_table"]);
});

test("create_table maps size and position to normalized params", async () => {
  const { calls, tools } = harness();
  await tools.create_table({
    presentation_id: "p",
    page_object_id: "s1",
    rows: 3,
    columns: 2,
    x_pt: 30,
    y_pt: 40,
    width_pt: 400,
    height_pt: 200,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    pageObjectId: "s1",
    rows: 3,
    columns: 2,
    xPt: 30,
    yPt: 40,
    widthPt: 400,
    heightPt: 200,
    objectId: undefined,
  });
});

test("edit_table forwards the action and its coordinates", async () => {
  const { calls, tools } = harness();
  await tools.edit_table({
    presentation_id: "p",
    table_object_id: "t1",
    action: "insert_rows",
    row_index: 0,
    count: 3,
    below: false,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    tableObjectId: "t1",
    action: "insert_rows",
    rowIndex: 0,
    columnIndex: undefined,
    count: 3,
    below: false,
    right: undefined,
  });
  await tools.edit_table({ presentation_id: "p", table_object_id: "t1", action: "delete_column", column_index: 1 });
  const params = calls[1].params[0] as Record<string, unknown>;
  assert.equal(params.action, "delete_column");
  assert.equal(params.columnIndex, 1);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "editTable" });
  const res = await tools.edit_table({ presentation_id: "p", table_object_id: "t", action: "delete_row", row_index: 0 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
