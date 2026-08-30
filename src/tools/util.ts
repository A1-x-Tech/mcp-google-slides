import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */
export const presentationIdSchema = () =>
  z
    .string()
    .min(1)
    .describe(
      "The presentation id — the long id from the URL (docs.google.com/presentation/d/<presentationId>/edit) or from create_presentation output.",
    );

/** An existing object id (slide, page element, table, ...) as returned by get_presentation/list_slides. */
export const objectIdSchema = (what: string) => z.string().min(1).describe(what);

/**
 * A caller-chosen id for a new object. The API's contract: 5-50 chars of
 * [a-zA-Z0-9_-:], not starting with '-' or ':'.
 */
export const newObjectIdSchema = () =>
  z
    .string()
    .regex(/^[A-Za-z0-9_][A-Za-z0-9_:-]{4,49}$/, "5-50 chars of [a-zA-Z0-9_-:], not starting with - or :");

/** A 0-based index (slide position, table row/column, text insertion point). */
export const indexSchema = () => z.number().int().min(0);

/** A length/coordinate in points (PT). 1 pt = 12700 EMU; a default slide is 720x405 pt. */
export const pointsSchema = () => z.number().finite();

/** A hex RGB color like #FF8800 (the leading # is optional). */
export const hexColorSchema = () => z.string().regex(/^#?[0-9a-fA-F]{6}$/, "Must be a hex RGB color like #FF8800");

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The Slides API mixes reads and writes, so each tool picks one of four presets:
 * READ_ONLY (pure reads), WRITE (creates new state; replaying duplicates it),
 * UPDATE (overwrites existing fields; replaying the same update converges) and
 * DESTRUCTIVE (removes existing state; replaying hits different targets).
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
