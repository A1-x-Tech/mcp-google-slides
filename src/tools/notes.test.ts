import { test } from "node:test";
import assert from "node:assert/strict";
import { registerNoteTools } from "./notes.js";

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
    getSpeakerNotes: make("getSpeakerNotes"),
    setSpeakerNotes: make("setSpeakerNotes"),
  };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerNoteTools(server as never, client as never);
  return { calls, tools };
}

test("registers the two speaker-notes tools", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools).sort(), ["get_speaker_notes", "set_speaker_notes"]);
});

test("get_speaker_notes addresses the slide, not the notes shape", async () => {
  const { calls, tools } = harness();
  await tools.get_speaker_notes({ presentation_id: "p", slide_object_id: "slide-1" });
  assert.deepEqual(calls[0], { method: "getSpeakerNotes", params: ["p", "slide-1"] });
});

test("set_speaker_notes forwards the text (empty clears)", async () => {
  const { calls, tools } = harness();
  await tools.set_speaker_notes({ presentation_id: "p", slide_object_id: "slide-1", text: "Say hi" });
  assert.deepEqual(calls[0], { method: "setSpeakerNotes", params: ["p", "slide-1", "Say hi"] });
  await tools.set_speaker_notes({ presentation_id: "p", slide_object_id: "slide-1", text: "" });
  assert.deepEqual(calls[1].params, ["p", "slide-1", ""]);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "setSpeakerNotes" });
  const res = await tools.set_speaker_notes({ presentation_id: "p", slide_object_id: "s", text: "x" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});
