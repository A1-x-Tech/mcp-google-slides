import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractText,
  GoogleSlidesClient,
  hexToRgbColor,
  sniffImageType,
  summarizePresentation,
  validateImageUrl,
} from "./client.js";
import { CredentialsError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleSlidesConfig } from "./types.js";

const BASE = "https://slides.googleapis.com";
const DRIVE = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Call = { url: string; method: string; auth: unknown; body: string | Buffer | undefined };

/** A client on a static access token — no token-endpoint traffic expected. */
function staticConfig(extra: Partial<GoogleSlidesConfig> = {}): GoogleSlidesConfig {
  return { accessToken: "STATIC", apiBase: BASE, driveApiBase: DRIVE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** A client on the refresh flow. */
function refreshConfig(extra: Partial<GoogleSlidesConfig> = {}): GoogleSlidesConfig {
  return {
    clientId: "cid",
    clientSecret: "csec",
    refreshToken: "rtok",
    apiBase: BASE,
    driveApiBase: DRIVE,
    maxRetries: 0,
    retryBaseMs: 0,
    ...extra,
  };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({
      url: String(url),
      method: String(i.method),
      auth: i.headers?.Authorization,
      body: typeof i.body === "string" || Buffer.isBuffer(i.body) ? i.body : undefined,
    });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** Default handler: token endpoint mints TOK-1, everything else returns { ok: true }. */
function defaultHandler(url: string): Response {
  if (url === TOKEN_URL) return okJson({ access_token: "TOK-1", expires_in: 3600 });
  return okJson({ ok: true });
}

/** The last request body, parsed as JSON. */
function lastBody(calls: Call[]): Record<string, unknown> {
  const body = calls.at(-1)?.body;
  return JSON.parse(String(body));
}

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * and the forced 401 re-mint alike (maxRetries is deliberately non-zero here).
 */
test("no credentials at all: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.getPresentation("abc"),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        // The message is the product: it must name the variables and the restart.
        assert.match(err.message, /GOOGLE_SLIDES_CLIENT_ID/);
        assert.match(err.message, /GOOGLE_SLIDES_ACCESS_TOKEN/);
        assert.match(err.message, /restart the server/);
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no token mint, no replay");
  } finally {
    mock.restore();
  }
});

test("static access token: Bearer header, no token-endpoint traffic", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).getPresentation("abc");
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].url, `${BASE}/v1/presentations/abc`);
    assert.equal(mock.calls[0].method, "GET");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
  } finally {
    mock.restore();
  }
});

test("refresh flow: mints a token first, then caches it across requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(refreshConfig());
    await client.getPresentation("abc");
    await client.getPresentation("def");

    const tokenCalls = mock.calls.filter((c) => c.url === TOKEN_URL);
    assert.equal(tokenCalls.length, 1, "the second request must reuse the cached token");
    assert.equal(tokenCalls[0].method, "POST");
    const params = new URLSearchParams(String(tokenCalls[0].body));
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("client_id"), "cid");
    assert.equal(params.get("client_secret"), "csec");
    assert.equal(params.get("refresh_token"), "rtok");

    const apiCalls = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`));
    assert.equal(apiCalls.length, 2);
    for (const call of apiCalls) assert.equal(call.auth, "Bearer TOK-1");
  } finally {
    mock.restore();
  }
});

test("a 401 forces one re-mint and replays the request", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSlidesClient(refreshConfig()).getPresentation("abc");
    assert.deepEqual(result, { ok: true });
    assert.equal(minted, 2, "the 401 must force a second mint");
    const lastApi = mock.calls.filter((c) => c.url.startsWith(`${BASE}/`)).at(-1);
    assert.equal(lastApi?.auth, "Bearer TOK-2");
  } finally {
    mock.restore();
  }
});

test("the 401 re-mint replay does not consume the transient-retry budget", async () => {
  let minted = 0;
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      minted++;
      return okJson({ access_token: `TOK-${minted}`, expires_in: 3600 });
    }
    apiHits++;
    if (apiHits === 1) return new Response('{"error":{"message":"expired"}}', { status: 401 });
    if (apiHits <= 3) return new Response("slow down", { status: 429 });
    return okJson({ ok: true });
  });
  try {
    // maxRetries: 2 — after the one-shot 401 replay, the two 429s must still
    // both be retried; the replay eating one retry unit would throw HTTP 429.
    const result = await new GoogleSlidesClient(refreshConfig({ maxRetries: 2 })).getPresentation("abc");
    assert.deepEqual(result, { ok: true });
    assert.equal(apiHits, 4, "401 replay plus the full maxRetries budget of 429 retries");
  } finally {
    mock.restore();
  }
});

test("a persistent 401 throws instead of looping", async () => {
  let apiHits = 0;
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) return okJson({ access_token: "TOK", expires_in: 3600 });
    apiHits++;
    return new Response('{"error":{"message":"nope","status":"UNAUTHENTICATED"}}', { status: 401 });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(refreshConfig()).getPresentation("abc"),
      /HTTP 401: \[UNAUTHENTICATED\] nope/,
    );
    assert.equal(apiHits, 2, "exactly one replay after the forced re-mint");
  } finally {
    mock.restore();
  }
});

test("a failed token exchange surfaces the OAuth error", async () => {
  const mock = mockFetch((url) => {
    if (url === TOKEN_URL) {
      return new Response('{"error":"invalid_grant","error_description":"Token has been revoked."}', {
        status: 400,
      });
    }
    return okJson({ ok: true });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(refreshConfig()).getPresentation("abc"),
      /HTTP 400: invalid_grant: Token has been revoked\./,
    );
  } finally {
    mock.restore();
  }
});

// ---- Presentations ----

test("createPresentation posts only the title", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).createPresentation("Deck");
    assert.equal(mock.calls[0].url, `${BASE}/v1/presentations`);
    assert.equal(mock.calls[0].method, "POST");
    assert.deepEqual(lastBody(mock.calls), { title: "Deck" });
  } finally {
    mock.restore();
  }
});

test("getPresentation forwards the fields mask; getPage hits the page path", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.getPresentation("p1", "slides(objectId)");
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/presentations/p1");
    assert.equal(url.searchParams.get("fields"), "slides(objectId)");
    await client.getPage("p1", "slide-1");
    assert.equal(mock.calls[1].url, `${BASE}/v1/presentations/p1/pages/slide-1`);
  } finally {
    mock.restore();
  }
});

test("getThumbnail builds the thumbnail query and returns the payload as-is", async () => {
  const mock = mockFetch(() => okJson({ contentUrl: "https://lh3.googleusercontent.com/x", width: 1600, height: 900 }));
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).getThumbnail({
      presentationId: "p1",
      pageObjectId: "s1",
      size: "medium",
    })) as Record<string, unknown>;
    const url = new URL(mock.calls[0].url);
    assert.equal(url.pathname, "/v1/presentations/p1/pages/s1/thumbnail");
    assert.equal(url.searchParams.get("thumbnailProperties.mimeType"), "PNG");
    assert.equal(url.searchParams.get("thumbnailProperties.thumbnailSize"), "MEDIUM");
    assert.equal(result.contentUrl, "https://lh3.googleusercontent.com/x");
  } finally {
    mock.restore();
  }
});

test("getThumbnail with outputPath downloads the PNG without auth and saves it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slides-thumb-"));
  const out = join(dir, "slide.png");
  const mock = mockFetch((url) => {
    if (url.includes("/thumbnail")) {
      return okJson({ contentUrl: "https://lh3.googleusercontent.com/img-1", width: 800, height: 450 });
    }
    return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), { status: 200 });
  });
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).getThumbnail({
      presentationId: "p1",
      pageObjectId: "s1",
      outputPath: out,
    })) as Record<string, unknown>;
    assert.equal(mock.calls[1].url, "https://lh3.googleusercontent.com/img-1");
    assert.equal(mock.calls[1].auth, undefined, "the public download must not carry the Bearer token");
    assert.equal(result.saved_to, out);
    assert.equal(result.bytes, 4);
    const saved = await readFile(out);
    assert.deepEqual([...saved], [0x89, 0x50, 0x4e, 0x47]);
  } finally {
    mock.restore();
  }
});

test("getThumbnail refuses to download from a non-Google host", async () => {
  const mock = mockFetch(() => okJson({ contentUrl: "https://evil.example/img", width: 1, height: 1 }));
  try {
    await assert.rejects(
      () =>
        new GoogleSlidesClient(staticConfig()).getThumbnail({
          presentationId: "p1",
          pageObjectId: "s1",
          outputPath: "/tmp/never-written.png",
        }),
      /Unexpected thumbnail host/,
    );
    assert.equal(mock.calls.length, 1, "only the metadata request, no download");
  } finally {
    mock.restore();
  }
});

// ---- Slides ----

test("addSlide builds createSlide with layout reference and index", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.addSlide({ presentationId: "p", insertionIndex: 2, predefinedLayout: "TITLE_AND_BODY" });
    assert.equal(mock.calls[0].url, `${BASE}/v1/presentations/p:batchUpdate`);
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          createSlide: {
            insertionIndex: 2,
            slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
          },
        },
      ],
    });
    await client.addSlide({ presentationId: "p", layoutObjectId: "layout-7" });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ createSlide: { slideLayoutReference: { layoutId: "layout-7" } } }],
    });
    await assert.rejects(
      () => client.addSlide({ presentationId: "p", predefinedLayout: "BLANK", layoutObjectId: "l" }),
      /not both/,
    );
  } finally {
    mock.restore();
  }
});

test("duplicate/move/delete build the right batchUpdate requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.duplicateSlide("p", "slide-1");
    assert.deepEqual(lastBody(mock.calls), { requests: [{ duplicateObject: { objectId: "slide-1" } }] });
    await client.moveSlides("p", ["s1", "s2"], 0);
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ updateSlidesPosition: { slideObjectIds: ["s1", "s2"], insertionIndex: 0 } }],
    });
    await client.deleteObject("p", "shape-9");
    assert.deepEqual(lastBody(mock.calls), { requests: [{ deleteObject: { objectId: "shape-9" } }] });
  } finally {
    mock.restore();
  }
});

// ---- Text ----

test("insertText targets shapes and table cells", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.insertText({ presentationId: "p", objectId: "box", text: "Hi" });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ insertText: { objectId: "box", text: "Hi", insertionIndex: 0 } }],
    });
    await client.insertText({ presentationId: "p", objectId: "tbl", text: "Hi", rowIndex: 1, columnIndex: 2 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          insertText: {
            objectId: "tbl",
            cellLocation: { rowIndex: 1, columnIndex: 2 },
            text: "Hi",
            insertionIndex: 0,
          },
        },
      ],
    });
    await assert.rejects(
      () => client.insertText({ presentationId: "p", objectId: "tbl", text: "x", rowIndex: 1 }),
      /row_index and column_index/,
    );
  } finally {
    mock.restore();
  }
});

test("setText sends one atomic delete+insert batch", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).setText({ presentationId: "p", objectId: "box", text: "New" });
    assert.equal(mock.calls.length, 1, "one atomic batch, not two writes");
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        { deleteText: { objectId: "box", textRange: { type: "ALL" } } },
        { insertText: { objectId: "box", text: "New", insertionIndex: 0 } },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("setText on an empty target falls back to insert-only (the 400 applied nothing)", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) {
      return new Response(
        '{"error":{"code":400,"message":"Invalid requests[0].deleteText: The object has no text.","status":"INVALID_ARGUMENT"}}',
        { status: 400 },
      );
    }
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSlidesClient(staticConfig()).setText({
      presentationId: "p",
      objectId: "empty-box",
      text: "First words",
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls.length, 2);
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ insertText: { objectId: "empty-box", text: "First words", insertionIndex: 0 } }],
    });
  } finally {
    mock.restore();
  }
});

test("setText with empty text on an empty target reports the no-op instead of failing", async () => {
  const mock = mockFetch(() =>
    new Response('{"error":{"code":400,"message":"Invalid requests[0].deleteText: no text."}}', { status: 400 }),
  );
  try {
    const result = await new GoogleSlidesClient(staticConfig()).setText({
      presentationId: "p",
      objectId: "empty-box",
      text: "",
    });
    assert.deepEqual(result, { cleared: false, note: "The object had no text to delete." });
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("setText does not fall back when deleteText failed for another reason", async () => {
  const mock = mockFetch(() =>
    new Response(
      '{"error":{"code":400,"message":"Invalid requests[0].deleteText: The object (x) could not be found.","status":"INVALID_ARGUMENT"}}',
      { status: 400 },
    ),
  );
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).setText({ presentationId: "p", objectId: "x", text: "t" }),
      /could not be found/,
    );
    assert.equal(mock.calls.length, 1, "the root cause must surface — no insert-only resend to mask it");
  } finally {
    mock.restore();
  }
});

test("setText rethrows non-deleteText 400s untouched", async () => {
  const mock = mockFetch(() =>
    new Response('{"error":{"code":400,"message":"Invalid presentation id.","status":"INVALID_ARGUMENT"}}', {
      status: 400,
    }),
  );
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).setText({ presentationId: "p", objectId: "x", text: "t" }),
      /Invalid presentation id/,
    );
    assert.equal(mock.calls.length, 1, "no fallback resend for unrelated errors");
  } finally {
    mock.restore();
  }
});

test("replaceText defaults to case-sensitive across the whole deck", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.replaceText({ presentationId: "p", find: "{{name}}", replace: "Ada" });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        { replaceAllText: { containsText: { text: "{{name}}", matchCase: true }, replaceText: "Ada" } },
      ],
    });
    await client.replaceText({
      presentationId: "p",
      find: "a",
      replace: "b",
      matchCase: false,
      pageObjectIds: ["s1"],
    });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          replaceAllText: {
            containsText: { text: "a", matchCase: false },
            replaceText: "b",
            pageObjectIds: ["s1"],
          },
        },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("updateTextStyle computes the field mask and maps hex colors", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.updateTextStyle({
      presentationId: "p",
      objectId: "box",
      bold: true,
      fontSizePt: 24,
      foregroundColor: "#FF0000",
    });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          updateTextStyle: {
            objectId: "box",
            style: {
              bold: true,
              fontSize: { magnitude: 24, unit: "PT" },
              foregroundColor: { opaqueColor: { rgbColor: { red: 1, green: 0, blue: 0 } } },
            },
            textRange: { type: "ALL" },
            fields: "bold,fontSize,foregroundColor",
          },
        },
      ],
    });
    await client.updateTextStyle({ presentationId: "p", objectId: "box", italic: false, startIndex: 2, endIndex: 5 });
    const req = (lastBody(mock.calls).requests as Array<Record<string, unknown>>)[0]
      .updateTextStyle as Record<string, unknown>;
    assert.deepEqual(req.textRange, { type: "FIXED_RANGE", startIndex: 2, endIndex: 5 });
    assert.equal(req.fields, "italic");
    await assert.rejects(() => client.updateTextStyle({ presentationId: "p", objectId: "box" }), /At least one/);
    await assert.rejects(
      () => client.updateTextStyle({ presentationId: "p", objectId: "box", bold: true, startIndex: 1 }),
      /start_index and end_index/,
    );
  } finally {
    mock.restore();
  }
});

// ---- Shapes, images, transforms ----

test("createShape maps the type, applies default geometry and chains the text atomically", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).createShape({
      presentationId: "p",
      pageObjectId: "s1",
      shapeType: "star",
      text: "Wow",
      objectId: "shape_1",
    });
    assert.equal(mock.calls.length, 1, "shape + text land in one atomic batch");
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          createShape: {
            objectId: "shape_1",
            shapeType: "STAR_5",
            elementProperties: {
              pageObjectId: "s1",
              size: { width: { magnitude: 300, unit: "PT" }, height: { magnitude: 80, unit: "PT" } },
              transform: { scaleX: 1, scaleY: 1, translateX: 50, translateY: 50, unit: "PT" },
            },
          },
        },
        { insertText: { objectId: "shape_1", text: "Wow", insertionIndex: 0 } },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("createShape without an id generates a valid one and reuses it for the text", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).createShape({
      presentationId: "p",
      pageObjectId: "s1",
      shapeType: "text_box",
      text: "Hello",
    });
    const requests = lastBody(mock.calls).requests as Array<Record<string, Record<string, unknown>>>;
    const id = requests[0].createShape.objectId as string;
    assert.match(id, /^[A-Za-z0-9_][A-Za-z0-9_:-]{4,49}$/);
    assert.equal(requests[1].insertText.objectId, id);
  } finally {
    mock.restore();
  }
});

test("createImage with a public URL validates it and builds createImage", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.createImage({
      presentationId: "p",
      pageObjectId: "s1",
      imageUrl: "https://example.com/pic.png",
      xPt: 10,
      yPt: 20,
      widthPt: 200,
      heightPt: 100,
    });
    assert.equal(mock.calls.length, 1, "no Drive traffic for a URL image");
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          createImage: {
            url: "https://example.com/pic.png",
            elementProperties: {
              pageObjectId: "s1",
              size: { width: { magnitude: 200, unit: "PT" }, height: { magnitude: 100, unit: "PT" } },
              transform: { scaleX: 1, scaleY: 1, translateX: 10, translateY: 20, unit: "PT" },
            },
          },
        },
      ],
    });
    await assert.rejects(
      () => client.createImage({ presentationId: "p", pageObjectId: "s1" }),
      /exactly one of image_url or image_path/,
    );
    await assert.rejects(
      () =>
        client.createImage({
          presentationId: "p",
          pageObjectId: "s1",
          imageUrl: "https://x/",
          imagePath: "/tmp/x.png",
        }),
      /exactly one of image_url or image_path/,
    );
  } finally {
    mock.restore();
  }
});

test("createImage with a local path uploads, shares, inserts and cleans up the temp file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slides-img-"));
  const img = join(dir, "logo.png");
  await writeFile(img, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
  const mock = mockFetch((url, init) => {
    if (url.startsWith(`${DRIVE}/upload/drive/v3/files`)) return okJson({ id: "drive-file-1" });
    if (url.includes("/permissions")) return okJson({ id: "perm-1" });
    if (url.includes(":batchUpdate")) return okJson({ replies: [{ createImage: { objectId: "img-1" } }] });
    if (String(init.method) === "DELETE") return new Response(null, { status: 204 });
    return okJson({ ok: true });
  });
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).createImage({
      presentationId: "p",
      pageObjectId: "s1",
      imagePath: img,
    })) as Record<string, unknown>;

    const [upload, perm, insert, cleanup] = mock.calls;
    assert.match(upload.url, /upload\/drive\/v3\/files\?uploadType=multipart/);
    assert.equal(upload.method, "POST");
    assert.match(String(upload.body), /image\/png/);
    assert.equal(perm.url, `${DRIVE}/drive/v3/files/drive-file-1/permissions`);
    assert.deepEqual(JSON.parse(String(perm.body)), { role: "reader", type: "anyone" });
    assert.equal(insert.url, `${BASE}/v1/presentations/p:batchUpdate`);
    const createImage = (JSON.parse(String(insert.body)).requests as Array<Record<string, Record<string, unknown>>>)[0]
      .createImage;
    assert.equal(createImage.url, "https://drive.google.com/uc?id=drive-file-1");
    assert.equal(cleanup.method, "DELETE");
    assert.equal(cleanup.url, `${DRIVE}/drive/v3/files/drive-file-1`);
    assert.deepEqual(result.uploaded_image, { drive_file_id: "drive-file-1", temp_file: "deleted" });
  } finally {
    mock.restore();
  }
});

test("createImage from a local path cleans up the temp file when the insert fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slides-img-"));
  const img = join(dir, "logo.gif");
  await writeFile(img, Buffer.from("GIF89a-not-really", "ascii"));
  const deletes: string[] = [];
  const mock = mockFetch((url, init) => {
    if (url.startsWith(`${DRIVE}/upload/drive/v3/files`)) return okJson({ id: "tmp-2" });
    if (url.includes("/permissions")) return okJson({ id: "perm" });
    if (String(init.method) === "DELETE") {
      deletes.push(url);
      return new Response(null, { status: 204 });
    }
    return new Response('{"error":{"message":"boom"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).createImage({ presentationId: "p", pageObjectId: "s", imagePath: img }),
      /boom/,
    );
    assert.deepEqual(deletes, [`${DRIVE}/drive/v3/files/tmp-2`], "the temp file must be cleaned up on failure too");
  } finally {
    mock.restore();
  }
});

test("createImage rejects junk files by magic bytes before any upload", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slides-img-"));
  const file = join(dir, "fake.png");
  await writeFile(file, Buffer.from("just text pretending to be a png"));
  const mock = mockFetch(defaultHandler);
  try {
    await assert.rejects(
      () =>
        new GoogleSlidesClient(staticConfig()).createImage({
          presentationId: "p",
          pageObjectId: "s",
          imagePath: file,
        }),
      /Unsupported image content/,
    );
    assert.equal(mock.calls.length, 0, "nothing may be uploaded");
  } finally {
    mock.restore();
  }
});

test("replaceImage keeps the frame and maps the replace method", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    await new GoogleSlidesClient(staticConfig()).replaceImage({
      presentationId: "p",
      imageObjectId: "img-1",
      imageUrl: "https://example.com/new.png",
      replaceMethod: "center_crop",
    });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          replaceImage: {
            imageObjectId: "img-1",
            url: "https://example.com/new.png",
            imageReplaceMethod: "CENTER_CROP",
          },
        },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("updateTransform defaults absolute scale to 1 and maps the mode", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.updateTransform({ presentationId: "p", objectId: "el", mode: "absolute", translateXPt: 100, translateYPt: 50 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          updatePageElementTransform: {
            objectId: "el",
            applyMode: "ABSOLUTE",
            transform: { scaleX: 1, scaleY: 1, translateX: 100, translateY: 50, unit: "PT" },
          },
        },
      ],
    });
    await client.updateTransform({ presentationId: "p", objectId: "el", mode: "relative", scaleX: 2, scaleY: 2 });
    const req = (lastBody(mock.calls).requests as Array<Record<string, Record<string, unknown>>>)[0]
      .updatePageElementTransform;
    assert.equal(req.applyMode, "RELATIVE");
    assert.deepEqual(req.transform, { scaleX: 2, scaleY: 2, translateX: 0, translateY: 0, unit: "PT" });
  } finally {
    mock.restore();
  }
});

// ---- Tables ----

test("createTable and editTable build the right requests", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.createTable({ presentationId: "p", pageObjectId: "s1", rows: 3, columns: 4 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ createTable: { elementProperties: { pageObjectId: "s1" }, rows: 3, columns: 4 } }],
    });
    await client.editTable({ presentationId: "p", tableObjectId: "t", action: "insert_rows", rowIndex: 1, count: 2 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        { insertTableRows: { tableObjectId: "t", cellLocation: { rowIndex: 1 }, insertBelow: true, number: 2 } },
      ],
    });
    await client.editTable({
      presentationId: "p",
      tableObjectId: "t",
      action: "insert_columns",
      columnIndex: 0,
      right: false,
    });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        {
          insertTableColumns: { tableObjectId: "t", cellLocation: { columnIndex: 0 }, insertRight: false, number: 1 },
        },
      ],
    });
    await client.editTable({ presentationId: "p", tableObjectId: "t", action: "delete_row", rowIndex: 2 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ deleteTableRow: { tableObjectId: "t", cellLocation: { rowIndex: 2 } } }],
    });
    await client.editTable({ presentationId: "p", tableObjectId: "t", action: "delete_column", columnIndex: 3 });
    assert.deepEqual(lastBody(mock.calls), {
      requests: [{ deleteTableColumn: { tableObjectId: "t", cellLocation: { columnIndex: 3 } } }],
    });
    await assert.rejects(
      () => client.editTable({ presentationId: "p", tableObjectId: "t", action: "delete_row" }),
      /requires row_index/,
    );
  } finally {
    mock.restore();
  }
});

// ---- Speaker notes ----

const SLIDE_WITH_NOTES = {
  objectId: "slide-1",
  slideProperties: {
    notesPage: {
      notesProperties: { speakerNotesObjectId: "notes-shape-1" },
      pageElements: [
        { objectId: "thumb", shape: {} },
        {
          objectId: "notes-shape-1",
          shape: {
            text: {
              textElements: [
                { paragraphMarker: {} },
                { textRun: { content: "Remember the demo.\n" } },
              ],
            },
          },
        },
      ],
    },
  },
};

test("getSpeakerNotes resolves the notes shape and extracts plain text", async () => {
  const mock = mockFetch(() => okJson(SLIDE_WITH_NOTES));
  try {
    const result = await new GoogleSlidesClient(staticConfig()).getSpeakerNotes("p", "slide-1");
    assert.equal(mock.calls[0].url, `${BASE}/v1/presentations/p/pages/slide-1`);
    assert.deepEqual(result, {
      slideObjectId: "slide-1",
      speakerNotesObjectId: "notes-shape-1",
      text: "Remember the demo.",
    });
  } finally {
    mock.restore();
  }
});

test("setSpeakerNotes rewrites the notes shape atomically", async () => {
  const mock = mockFetch((url) => {
    if (url.includes("/pages/")) return okJson(SLIDE_WITH_NOTES);
    return okJson({ replies: [{}, {}] });
  });
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).setSpeakerNotes(
      "p",
      "slide-1",
      "New notes",
    )) as Record<string, unknown>;
    assert.equal(result.speakerNotesObjectId, "notes-shape-1");
    assert.deepEqual(lastBody(mock.calls), {
      requests: [
        { deleteText: { objectId: "notes-shape-1", textRange: { type: "ALL" } } },
        { insertText: { objectId: "notes-shape-1", text: "New notes", insertionIndex: 0 } },
      ],
    });
  } finally {
    mock.restore();
  }
});

test("speaker notes on a page without notes fail with a readable error", async () => {
  const mock = mockFetch(() => okJson({ objectId: "layout-1", layoutProperties: {} }));
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).getSpeakerNotes("p", "layout-1"),
      /No speaker-notes shape/,
    );
  } finally {
    mock.restore();
  }
});

// ---- Comments (Drive origin) ----

test("comment actions hit the Drive API with explicit fields masks", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const client = new GoogleSlidesClient(staticConfig());
    await client.manageComments({ presentationId: "p1", action: "list", pageSize: 50 });
    const listUrl = new URL(mock.calls[0].url);
    assert.equal(listUrl.origin, DRIVE);
    assert.equal(listUrl.pathname, "/drive/v3/files/p1/comments");
    assert.equal(listUrl.searchParams.get("pageSize"), "50");
    assert.ok(listUrl.searchParams.get("fields")?.includes("comments("), "list must set an explicit fields mask");

    await client.manageComments({ presentationId: "p1", action: "create", content: "Looks great" });
    assert.equal(mock.calls[1].method, "POST");
    assert.deepEqual(JSON.parse(String(mock.calls[1].body)), { content: "Looks great" });

    await client.manageComments({ presentationId: "p1", action: "reply", commentId: "c1", resolve: true });
    const replyUrl = new URL(mock.calls[2].url);
    assert.equal(replyUrl.pathname, "/drive/v3/files/p1/comments/c1/replies");
    assert.deepEqual(JSON.parse(String(mock.calls[2].body)), { action: "resolve" });

    await client.manageComments({ presentationId: "p1", action: "get", commentId: "c1" });
    assert.equal(new URL(mock.calls[3].url).pathname, "/drive/v3/files/p1/comments/c1");

    await client.manageComments({ presentationId: "p1", action: "delete", commentId: "c1" });
    assert.equal(mock.calls[4].method, "DELETE");

    await assert.rejects(
      () => client.manageComments({ presentationId: "p1", action: "reply", commentId: "c1" }),
      /requires content/,
    );
    await assert.rejects(() => client.manageComments({ presentationId: "p1", action: "get" }), /requires comment_id/);
  } finally {
    mock.restore();
  }
});

// ---- Export ----

test("exportPresentation downloads via Drive export and writes the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slides-export-"));
  const out = join(dir, "deck.pdf");
  const mock = mockFetch(() => new Response(Buffer.from("%PDF-1.7 fake"), { status: 200 }));
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).exportPresentation(
      "p1",
      "pdf",
      out,
    )) as Record<string, unknown>;
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin, DRIVE);
    assert.equal(url.pathname, "/drive/v3/files/p1/export");
    assert.equal(url.searchParams.get("mimeType"), "application/pdf");
    assert.equal(mock.calls[0].auth, "Bearer STATIC");
    assert.equal(result.saved_to, out);
    assert.equal(result.mime_type, "application/pdf");
    assert.equal(await readFile(out, "utf8"), "%PDF-1.7 fake");
  } finally {
    mock.restore();
  }
});

test("exportPresentation surfaces the Drive error body", async () => {
  const mock = mockFetch(
    () =>
      new Response('{"error":{"message":"This file is too large to be exported.","code":403}}', { status: 403 }),
  );
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).exportPresentation("p1", "pptx", "/tmp/never.pptx"),
      /too large to be exported/,
    );
  } finally {
    mock.restore();
  }
});

// ---- Summaries ----

test("listSlides asks for the trimmed fields mask and compacts the deck", async () => {
  const mock = mockFetch(() =>
    okJson({
      presentationId: "p1",
      title: "Deck",
      revisionId: "r9",
      pageSize: { width: { magnitude: 9144000, unit: "EMU" }, height: { magnitude: 5143500, unit: "EMU" } },
      slides: [
        {
          objectId: "s1",
          slideProperties: {
            layoutObjectId: "layout-1",
            notesPage: { notesProperties: { speakerNotesObjectId: "n1" } },
          },
          pageElements: [
            {
              objectId: "title-1",
              shape: {
                shapeType: "TEXT_BOX",
                placeholder: { type: "TITLE" },
                text: { textElements: [{ textRun: { content: "Q3 results\n" } }] },
              },
            },
            { objectId: "tbl-1", table: { rows: 2, columns: 3 } },
            { objectId: "img-1", image: { sourceUrl: "https://x" } },
          ],
        },
      ],
    }),
  );
  try {
    const result = (await new GoogleSlidesClient(staticConfig()).listSlides("p1")) as Record<string, unknown>;
    const url = new URL(mock.calls[0].url);
    assert.ok(url.searchParams.get("fields")?.startsWith("presentationId,"), "must request a trimmed fields mask");
    assert.equal(result.slideCount, 1);
    assert.deepEqual(result.pageSizePt, { width: 720, height: 405 });
    const slide = (result.slides as Array<Record<string, unknown>>)[0];
    assert.equal(slide.objectId, "s1");
    assert.equal(slide.speakerNotesObjectId, "n1");
    assert.deepEqual(slide.elements, [
      { objectId: "title-1", type: "text_box", placeholder: "title", text: "Q3 results" },
      { objectId: "tbl-1", type: "table", rows: 2, columns: 3 },
      { objectId: "img-1", type: "image" },
    ]);
  } finally {
    mock.restore();
  }
});

test("listLayouts compacts layouts, masters and the notes master", async () => {
  const mock = mockFetch(() =>
    okJson({
      layouts: [
        {
          objectId: "l1",
          layoutProperties: { name: "TITLE", displayName: "Title slide", masterObjectId: "m1" },
        },
      ],
      masters: [{ objectId: "m1", masterProperties: { displayName: "Simple Light" } }],
      notesMaster: { objectId: "nm1" },
    }),
  );
  try {
    const result = await new GoogleSlidesClient(staticConfig()).listLayouts("p1");
    assert.deepEqual(result, {
      layouts: [{ objectId: "l1", name: "TITLE", displayName: "Title slide", masterObjectId: "m1" }],
      masters: [{ objectId: "m1", displayName: "Simple Light" }],
      notesMasterObjectId: "nm1",
    });
  } finally {
    mock.restore();
  }
});

test("summarizePresentation truncates long text and counts group children", () => {
  const long = "x".repeat(300);
  const summary = summarizePresentation({
    slides: [
      {
        objectId: "s1",
        pageElements: [
          { objectId: "a", shape: { text: { textElements: [{ textRun: { content: long } }] } } },
          { objectId: "g", elementGroup: { children: [{ objectId: "c1" }, { objectId: "c2" }] } },
          { objectId: "v", video: { id: "yt" } },
          { objectId: "l", line: {} },
          { objectId: "m" },
        ],
      },
    ],
  });
  const elements = (summary.slides as Array<{ elements: Array<Record<string, unknown>> }>)[0].elements;
  assert.equal(String(elements[0].text).length, 161); // 160 + ellipsis
  assert.deepEqual(elements[1], { objectId: "g", type: "group", children: 2 });
  assert.equal(elements[2].type, "video");
  assert.equal(elements[3].type, "line");
  assert.equal(elements[4].type, "unknown");
});

// ---- Pure helpers ----

test("validateImageUrl accepts public https and rejects http, size and private hosts", () => {
  validateImageUrl("https://example.com/a.png");
  assert.throws(() => validateImageUrl("not a url"), /absolute URL/);
  assert.throws(() => validateImageUrl("http://example.com/a.png"), /https/);
  assert.throws(() => validateImageUrl(`https://example.com/${"a".repeat(2000)}`), /too long/);
  for (const host of [
    "localhost",
    "foo.localhost",
    "printer.local",
    "db.internal",
    "127.0.0.1",
    "10.0.0.5",
    "192.168.1.1",
    "172.16.0.9",
    "172.31.255.1",
    "169.254.1.1",
    "0.0.0.0",
    "[::1]",
    "[fe80::1]",
  ]) {
    assert.throws(() => validateImageUrl(`https://${host}/img.png`), /private or local host/, host);
  }
  // Public 172.x outside the private block is fine.
  validateImageUrl("https://172.32.0.1/img.png");
});

test("sniffImageType identifies png/jpeg/gif by magic bytes and rejects the rest", () => {
  assert.equal(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mimeType, "image/png");
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mimeType, "image/jpeg");
  assert.equal(sniffImageType(Buffer.from("GIF89a"))?.mimeType, "image/gif");
  assert.equal(sniffImageType(Buffer.from("BM....")), undefined); // bmp is not accepted
  assert.equal(sniffImageType(Buffer.from("<svg/>")), undefined);
});

test("hexToRgbColor parses with or without the leading #", () => {
  assert.deepEqual(hexToRgbColor("#FFFFFF"), { red: 1, green: 1, blue: 1 });
  assert.deepEqual(hexToRgbColor("000000"), { red: 0, green: 0, blue: 0 });
  assert.deepEqual(hexToRgbColor("#FF8000"), { red: 1, green: 0.502, blue: 0 });
});

test("extractText joins runs and drops the trailing newline", () => {
  assert.equal(
    extractText({ textElements: [{ textRun: { content: "a " } }, { paragraphMarker: {} }, { textRun: { content: "b\n" } }] }),
    "a b",
  );
  assert.equal(extractText(undefined), "");
  assert.equal(extractText({}), "");
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries a 429 for reads and writes alike", async () => {
  for (const run of [
    () => new GoogleSlidesClient(staticConfig({ maxRetries: 3 })).getPresentation("p"),
    () => new GoogleSlidesClient(staticConfig({ maxRetries: 3 })).deleteObject("p", "o"),
  ]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("slow down", { status: 429 });
      return okJson({ ok: true });
    });
    try {
      assert.deepEqual(await run(), { ok: true });
      assert.equal(n, 2);
    } finally {
      mock.restore();
    }
  }
});

test("request() retries a 5xx only for GET — a write is never replayed", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("unavailable", { status: 503 });
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSlidesClient(staticConfig({ maxRetries: 3 })).getPresentation("p");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2, "the read is retried");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("unavailable", { status: 503 });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig({ maxRetries: 3 })).deleteObject("p", "o"),
      /HTTP 503/,
    );
    assert.equal(n, 1, "a 503 on a write must not be replayed — the delete may have committed");
  } finally {
    mock2.restore();
  }
});

test("request() retries a network error only for GET", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleSlidesClient(staticConfig({ maxRetries: 2 })).getPresentation("p");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    throw new Error("ECONNRESET");
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig({ maxRetries: 2 })).deleteObject("p", "o"),
      /ECONNRESET/,
    );
    assert.equal(n, 1, "a network error on a write must not be replayed");
  } finally {
    mock2.restore();
  }
});

test("request() does not retry a 400 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig({ maxRetries: 3 })).getPresentation("p"),
      /HTTP 400: \[INVALID_ARGUMENT\] bad/,
    );
    assert.equal(n, 1);
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response("slow down", { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig({ maxRetries: 2 })).getPresentation("p"),
      /HTTP 429/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("request() aborts and reports a timeout when the request hangs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleSlidesClient(staticConfig({ timeoutMs: 10, maxRetries: 0 }));
    await client.getPresentation("p").then(
      () => assert.fail("must reject"),
      (err) => assert.match(String(err), /timed out after 10ms/),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleSlidesClient(staticConfig()).request("GET", evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("a Drive URL through raw_request's client path is a foreign origin too", async () => {
  const mock = mockFetch(() => okJson({}));
  try {
    await assert.rejects(
      () => new GoogleSlidesClient(staticConfig()).request("GET", `${DRIVE}/drive/v3/files`),
      /foreign origin/,
    );
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(defaultHandler);
  try {
    const result = await new GoogleSlidesClient(staticConfig()).request(
      "GET",
      "v1/presentations/p1?fields=slides(objectId)",
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(mock.calls[0].url, `${BASE}/v1/presentations/p1?fields=slides(objectId)`);
  } finally {
    mock.restore();
  }
});
