import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTRUCTIVE,
  fail,
  hexColorSchema,
  newObjectIdSchema,
  ok,
  presentationIdSchema,
  READ_ONLY,
  UPDATE,
  WRITE,
} from "./util.js";

test("newObjectIdSchema enforces the API's object-id contract", () => {
  const s = newObjectIdSchema(); // factory → fresh schema
  assert.equal(s.safeParse("slide_12345").success, true);
  assert.equal(s.safeParse("a:b-c_d12").success, true);
  assert.equal(s.safeParse("abcd").success, false); // too short (< 5)
  assert.equal(s.safeParse("-leading-dash").success, false);
  assert.equal(s.safeParse(":leading-colon").success, false);
  assert.equal(s.safeParse("has space").success, false);
  assert.equal(s.safeParse("x".repeat(51)).success, false);
});

test("hexColorSchema accepts #RRGGBB with or without the hash", () => {
  const s = hexColorSchema();
  assert.equal(s.safeParse("#FF8800").success, true);
  assert.equal(s.safeParse("ff8800").success, true);
  assert.equal(s.safeParse("#FFF").success, false);
  assert.equal(s.safeParse("red").success, false);
});

test("schema factories return independent schemas (no $ref dedup)", () => {
  assert.notEqual(presentationIdSchema(), presentationIdSchema());
  assert.notEqual(newObjectIdSchema(), newObjectIdSchema());
});

test("ok emits compact JSON; fail flags isError", () => {
  assert.equal((ok({ a: 1 }).content[0] as { text: string }).text, '{"a":1}');
  const f = fail(new Error("boom"));
  assert.equal(f.isError, true);
  assert.match((f.content[0] as { text: string }).text, /boom/);
});

test("fail appends the underlying cause when present", () => {
  const err = new Error("timeout", { cause: new Error("ECONNRESET") });
  const f = fail(err);
  assert.match((f.content[0] as { text: string }).text, /timeout \(ECONNRESET\)/);
});

test("the four annotation presets set all four hints explicitly", () => {
  assert.deepEqual(READ_ONLY, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(UPDATE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(DESTRUCTIVE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});
