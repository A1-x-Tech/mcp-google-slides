#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleSlidesClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, DEFAULT_DRIVE_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleSlidesConfig } from "./types.js";
import { registerPresentationTools } from "./tools/presentations.js";
import { registerSlideTools } from "./tools/slides.js";
import { registerTextTools } from "./tools/text.js";
import { registerElementTools } from "./tools/elements.js";
import { registerTableTools } from "./tools/tables.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerExportTools } from "./tools/export.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or duplicating.
 */
const INSTRUCTIONS =
  "Google Slides API v1 builds and edits presentations — not Docs, Sheets or Drive browsing: " +
  "comments and export ride the Drive API internally for this one file; sharing, renaming, listing " +
  "and deleting files are out of reach (create_presentation cannot be undone here). Everything is " +
  "addressed by object ids — start with list_slides, not get_presentation (a full deck is hundreds " +
  "of kilobytes). All writes are batchUpdate and atomic: one invalid request voids the whole batch, " +
  "nothing is applied. Coordinates are points (a 16:9 slide is 720x405 pt); JSON responses use EMU " +
  "(1 pt = 12700 EMU). update_transform mode=absolute replaces the entire transform — omitted scale " +
  "resets to 1, not to the current value. create_image needs a URL Google's servers can fetch " +
  "(public https, PNG/JPEG/GIF ≤50 MB, ≤25 MP); a local image_path is uploaded to Drive, inserted " +
  "and the temp file deleted automatically. Thumbnails return a ~30-minute contentUrl; export is " +
  "capped at 10 MB; both plus comments need a Drive scope on the token. Themes cannot be imported — " +
  "add_slide only instantiates layouts the deck already has (list_layouts). replace_text returning " +
  "occurrencesChanged:0 means the wording didn't match — re-check with list_slides. Writes are never " +
  "retried after a 5xx or timeout: verify with list_slides before re-sending; delete_object is final.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. There is no in-chat login here: credentials
 * come only from the environment, so the fix is an operator action + restart.
 */
const UNCONFIGURED_PREFIX =
  "ATTENTION: Google Slides is not connected yet — no credentials are configured, so every " +
  "tool call will fail. The operator must set GOOGLE_SLIDES_CLIENT_ID + " +
  "GOOGLE_SLIDES_CLIENT_SECRET + GOOGLE_SLIDES_REFRESH_TOKEN (recommended), or " +
  "GOOGLE_SLIDES_ACCESS_TOKEN with a short-lived access token, in the MCP client's " +
  "server config and restart this server — the variables are read only at startup. ";

/** Reads the package version so the server reports its real version to MCP clients. */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Loads the config without dying on a bad value. A server that exits here never
 * completes the MCP handshake, so the user sees a dead server and no reason.
 * Instead the problem is carried into the session, where the model can read it
 * and relay it: the config degrades to "no credentials" and every tool call
 * fails with the actionable message.
 */
function loadConfigOrDegraded(telemetry: Telemetry): {
  config: GoogleSlidesConfig;
  problem?: ConfigError;
} {
  try {
    return { config: loadConfig() };
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(`Error: ${err.message}`);
    // Fire-and-forget now that the process survives: the historical
    // `startup_failed` funnel stays comparable, but nothing blocks startup.
    telemetry.send("startup_failed", { reason: err.reason });
    return {
      config: {
        apiBase: process.env.GOOGLE_SLIDES_API_BASE || DEFAULT_BASE,
        driveApiBase: process.env.GOOGLE_SLIDES_DRIVE_API_BASE || DEFAULT_DRIVE_BASE,
      },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never data or arguments);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);
  const client = new GoogleSlidesClient(config);

  // Decided once, at startup: credentials come only from the environment, so
  // "restart after setting the variables" is the accurate advice to give.
  const connected = hasCredentials(config);

  const server = new McpServer(
    {
      name: "mcp-google-slides",
      version: readVersion(),
    },
    // Surfaces in the initialize result, before the client sees a single tool.
    {
      instructions: connected
        ? INSTRUCTIONS
        : UNCONFIGURED_PREFIX + (problem ? `Configuration problem: ${problem.message} ` : "") + INSTRUCTIONS,
    },
  );

  instrumentToolCalls(server, telemetry);
  server.server.oninitialized = () => {
    telemetry.setClientInfo(server.server.getClientVersion());
    // Split on purpose: `server_start` keeps meaning "a usable install started",
    // so the unconfigured case gets its own event instead of inflating that number.
    if (connected) telemetry.send("server_start");
    else telemetry.send("unconfigured_start", { reason: problem?.reason ?? "missing_credentials" });
  };

  registerPresentationTools(server, client);
  registerSlideTools(server, client);
  registerTextTools(server, client);
  registerElementTools(server, client);
  registerTableTools(server, client);
  registerNoteTools(server, client);
  registerCommentTools(server, client);
  registerExportTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-slides running on stdio${connected ? "" : " (no credentials — set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-slides:", err);
  process.exit(1);
});
