import { test } from "node:test";
import assert from "node:assert/strict";

import { ConfigError, hasCredentials, loadConfig } from "./config.js";

/**
 * The reason codes below are the vocabulary the telemetry dashboard groups by —
 * renaming one silently splits a bar in two, so they are pinned here.
 */
function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const keys = [
    "GOOGLE_SLIDES_CLIENT_ID",
    "GOOGLE_SLIDES_CLIENT_SECRET",
    "GOOGLE_SLIDES_REFRESH_TOKEN",
    "GOOGLE_SLIDES_ACCESS_TOKEN",
    "GOOGLE_SLIDES_API_BASE",
    "GOOGLE_SLIDES_DRIVE_API_BASE",
    "GOOGLE_SLIDES_TIMEOUT_MS",
    "GOOGLE_SLIDES_MAX_RETRIES",
    ...Object.keys(vars),
  ];
  const saved = new Map(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) process.env[k] = v;
  }
  try {
    run();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function reasonOf(vars: Record<string, string | undefined>): string {
  let caught: unknown;
  withEnv(vars, () => {
    try {
      loadConfig();
    } catch (err) {
      caught = err;
    }
  });
  assert.ok(caught instanceof ConfigError, "config problems must throw ConfigError, not exit");
  return caught.reason;
}

/**
 * Missing credentials must never kill the process before the MCP handshake —
 * the server starts degraded and the client raises CredentialsError on the
 * first call instead (pinned in client.test.ts). Reverting this would leave
 * the user a dead server with no reason.
 */
test("no credentials at all is not an error — the config loads with empty fields", () => {
  withEnv({}, () => {
    const config = loadConfig();
    assert.equal(config.clientId, undefined);
    assert.equal(config.clientSecret, undefined);
    assert.equal(config.refreshToken, undefined);
    assert.equal(config.accessToken, undefined);
    assert.equal(config.apiBase, "https://slides.googleapis.com");
    assert.equal(config.driveApiBase, "https://www.googleapis.com");
    assert.equal(hasCredentials(config), false);
  });
});

test("a partial OAuth triple reports incomplete_oauth_config", () => {
  assert.equal(reasonOf({ GOOGLE_SLIDES_CLIENT_ID: "id" }), "incomplete_oauth_config");
  assert.equal(
    reasonOf({ GOOGLE_SLIDES_CLIENT_ID: "id", GOOGLE_SLIDES_CLIENT_SECRET: "secret" }),
    "incomplete_oauth_config",
  );
  // Even with a static access token present, a half-configured refresh flow is
  // an error, not something to silently ignore.
  assert.equal(
    reasonOf({ GOOGLE_SLIDES_REFRESH_TOKEN: "rt", GOOGLE_SLIDES_ACCESS_TOKEN: "at" }),
    "incomplete_oauth_config",
  );
});

test("the full refresh triple loads without throwing", () => {
  withEnv(
    {
      GOOGLE_SLIDES_CLIENT_ID: "id",
      GOOGLE_SLIDES_CLIENT_SECRET: "secret",
      GOOGLE_SLIDES_REFRESH_TOKEN: "rt",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.clientId, "id");
      assert.equal(config.refreshToken, "rt");
      assert.equal(config.apiBase, "https://slides.googleapis.com");
      assert.equal(hasCredentials(config), true);
    },
  );
});

test("a static access token alone is enough", () => {
  withEnv({ GOOGLE_SLIDES_ACCESS_TOKEN: "at" }, () => {
    const config = loadConfig();
    assert.equal(config.accessToken, "at");
    assert.equal(hasCredentials(config), true);
  });
});

test("base overrides are honored", () => {
  withEnv(
    {
      GOOGLE_SLIDES_ACCESS_TOKEN: "at",
      GOOGLE_SLIDES_API_BASE: "https://slides.example.test",
      GOOGLE_SLIDES_DRIVE_API_BASE: "https://drive.example.test",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.apiBase, "https://slides.example.test");
      assert.equal(config.driveApiBase, "https://drive.example.test");
    },
  );
});

test("invalid numeric overrides fall back to the defaults", () => {
  withEnv(
    {
      GOOGLE_SLIDES_ACCESS_TOKEN: "at",
      GOOGLE_SLIDES_TIMEOUT_MS: "not-a-number",
      GOOGLE_SLIDES_MAX_RETRIES: "-5",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 60_000);
      assert.equal(config.maxRetries, 3);
    },
  );
});

test("numeric overrides are honored when valid", () => {
  withEnv(
    { GOOGLE_SLIDES_ACCESS_TOKEN: "at", GOOGLE_SLIDES_TIMEOUT_MS: "1000", GOOGLE_SLIDES_MAX_RETRIES: "0" },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 1000);
      assert.equal(config.maxRetries, 0);
    },
  );
});
