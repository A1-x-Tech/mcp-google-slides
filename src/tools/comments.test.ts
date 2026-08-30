import { test } from "node:test";
import assert from "node:assert/strict";
import { registerCommentTools } from "./comments.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const client = {
    manageComments: async (...params: unknown[]) => {
      calls.push({ method: "manageComments", params });
      if (opts.throwOn === "manageComments") throw new Error("boom");
      return { ok: true };
    },
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerCommentTools(server as never, client as never);
  return { calls, tools };
}

test("registers the single comments tool", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["manage_comments"]);
});

test("manage_comments maps every argument to normalized params", async () => {
  const { calls, tools } = harness();
  await tools.manage_comments({
    presentation_id: "p",
    action: "list",
    page_size: 25,
    page_token: "tok",
    include_deleted: true,
  });
  assert.deepEqual(calls[0].params[0], {
    presentationId: "p",
    action: "list",
    commentId: undefined,
    content: undefined,
    resolve: undefined,
    pageSize: 25,
    pageToken: "tok",
    includeDeleted: true,
  });
  await tools.manage_comments({ presentation_id: "p", action: "reply", comment_id: "c1", content: "Done", resolve: true });
  const params = calls[1].params[0] as Record<string, unknown>;
  assert.equal(params.commentId, "c1");
  assert.equal(params.content, "Done");
  assert.equal(params.resolve, true);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "manageComments" });
  const res = await tools.manage_comments({ presentation_id: "p", action: "list" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
