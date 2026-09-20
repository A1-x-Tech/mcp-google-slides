import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleSlidesClient } from "../dist/client.js";
import { registerPresentationTools } from "../dist/tools/presentations.js";
import { registerSlideTools } from "../dist/tools/slides.js";
import { registerTextTools } from "../dist/tools/text.js";
import { registerElementTools } from "../dist/tools/elements.js";
import { registerTableTools } from "../dist/tools/tables.js";
import { registerNoteTools } from "../dist/tools/notes.js";
import { registerCommentTools } from "../dist/tools/comments.js";
import { registerExportTools } from "../dist/tools/export.js";
import { registerRawTool } from "../dist/tools/raw.js";
import { registerAuthTools } from "../dist/tools/auth.js";

/**
 * Sorted, because every assertion compares it against a sorted tool list. The
 * six onboarding tools come from @a1-x-tech/mcp-google-auth, so this list is
 * also the check that the component is wired into the published binary.
 */
const ALL_TOOLS = [
  "add_slide",
  "auth_status",
  "batch_update",
  "create_image",
  "create_presentation",
  "create_shape",
  "create_table",
  "delete_object",
  "duplicate_slide",
  "edit_table",
  "export_presentation",
  "finish_login",
  "get_page",
  "get_presentation",
  "get_speaker_notes",
  "get_thumbnail",
  "insert_text",
  "list_layouts",
  "list_slides",
  "logout",
  "manage_comments",
  "move_slides",
  "raw_request",
  "replace_image",
  "replace_text",
  "set_client",
  "set_speaker_notes",
  "set_text",
  "setup_instructions",
  "start_login",
  "update_text_style",
  "update_transform",
];

/**
 * A throwaway $XDG_CONFIG_HOME for the spawned server. The auth component
 * re-reads $XDG_CONFIG_HOME/mcp-google-slides/credentials.json per call, so
 * without this a real login on the developer's machine would make the
 * "unconfigured" case pass for the wrong reason.
 */
function isolatedConfigDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "mcp-slides-dist-smoke-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}


test("dist client rejects foreign-origin paths before sending the Bearer token", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleSlidesClient({
      accessToken: "SECRET",
      apiBase: "https://slides.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("GET", "https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the Bearer token and JSON bodies", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response('{"presentationId":"p-1"}', { status: 200 });
  };
  try {
    const client = new GoogleSlidesClient({
      accessToken: "SECRET",
      apiBase: "https://slides.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await client.createPresentation("Smoke");
    assert.equal(seen.url, "https://slides.googleapis.com/v1/presentations");
    assert.equal(seen.auth, "Bearer SECRET");
    assert.deepEqual(seen.body, { title: "Smoke" });
  } finally {
    globalThis.fetch = original;
  }
});

test("dist registers the expected tools", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const client = {};

  registerAuthTools(server, client);
  registerPresentationTools(server, client);
  registerSlideTools(server, client);
  registerTextTools(server, client);
  registerElementTools(server, client);
  registerTableTools(server, client);
  registerNoteTools(server, client);
  registerCommentTools(server, client);
  registerExportTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_SLIDES_ACCESS_TOKEN: "test-token",
      XDG_CONFIG_HOME: isolatedConfigDir(t),
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-slides");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Google Slides API v1/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const listSlides = tools.find((t) => t.name === "list_slides");
    assert.equal(listSlides.annotations?.readOnlyHint, true);
    assert.ok(listSlides.inputSchema?.properties?.presentation_id, "input schema must reach the client");
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must still
 * start, list every tool, open the instructions with the fix, and answer a
 * tool call with the actionable error — offline: the CredentialsError fires
 * before any fetch, so this test never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async (t) => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_SLIDES_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
  env.XDG_CONFIG_HOME = isolatedConfigDir(t); // ignore any real login on this machine
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke-unconfigured", version: "0.0.0" });
  await client.connect(transport);
  try {
    // The model must read the fix before it picks a tool.
    const instructions = client.getInstructions() ?? "";
    assert.match(instructions, /NOT CONNECTED/);
    assert.match(instructions, /start_login/);
    assert.match(instructions, /GOOGLE_SLIDES_CLIENT_ID/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A tool call fails with the exact message instead of killing the server.
    const result = await client.callTool({ name: "list_slides", arguments: { presentation_id: "smoke-deck" } });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /not connected/i);
    assert.match(text, /start_login/);
    assert.match(text, /restart the server/);
  } finally {
    await client.close();
  }
});
