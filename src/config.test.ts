import { test } from "node:test";
import assert from "node:assert/strict";

import { ConfigError, hasCredentials, loadConfig } from "./config.js";

/**
 * The reason codes below are the vocabulary the telemetry dashboard groups by —
 * renaming one silently splits a bar in two, so they are pinned here.
 */
function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
  const keys = [
    "GOOGLE_CUSTOM_SEARCH_API_KEY",
    "GOOGLE_CUSTOM_SEARCH_ENGINE_ID",
    "GOOGLE_CUSTOM_SEARCH_API_BASE",
    "GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS",
    "GOOGLE_CUSTOM_SEARCH_MAX_RETRIES",
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

/**
 * Missing credentials must not throw here: a throw would kill the process
 * before the MCP handshake and leave the user with a dead server and no
 * reason. It is a survivable state — the server starts degraded and the client
 * raises CredentialsError on the first call instead (pinned in client.test.ts).
 */
test("no credentials at all is not an error — the config loads with empty fields", () => {
  withEnv({}, () => {
    const config = loadConfig();
    assert.equal(config.apiKey, undefined);
    assert.equal(config.engineId, undefined);
    assert.equal(config.apiBase, "https://customsearch.googleapis.com");
    assert.equal(hasCredentials(config), false);
  });
});

test("an engine id without an API key reports incomplete_config", () => {
  let caught: unknown;
  withEnv({ GOOGLE_CUSTOM_SEARCH_ENGINE_ID: "cx-1" }, () => {
    try {
      loadConfig();
    } catch (err) {
      caught = err;
    }
  });
  assert.ok(caught instanceof ConfigError, "config problems must throw ConfigError, not exit");
  assert.equal(caught.reason, "incomplete_config");
  assert.match(caught.message, /GOOGLE_CUSTOM_SEARCH_API_KEY/);
});

test("API key + engine id load without throwing", () => {
  withEnv({ GOOGLE_CUSTOM_SEARCH_API_KEY: "key-1", GOOGLE_CUSTOM_SEARCH_ENGINE_ID: "cx-1" }, () => {
    const config = loadConfig();
    assert.equal(config.apiKey, "key-1");
    assert.equal(config.engineId, "cx-1");
    assert.equal(config.apiBase, "https://customsearch.googleapis.com");
    assert.equal(hasCredentials(config), true);
  });
});

test("an API key alone is enough — the engine id can come per call", () => {
  withEnv({ GOOGLE_CUSTOM_SEARCH_API_KEY: "key-1" }, () => {
    const config = loadConfig();
    assert.equal(config.apiKey, "key-1");
    assert.equal(config.engineId, undefined);
    assert.equal(hasCredentials(config), true);
  });
});

test("invalid numeric overrides fall back to the defaults", () => {
  withEnv(
    {
      GOOGLE_CUSTOM_SEARCH_API_KEY: "key-1",
      GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS: "not-a-number",
      GOOGLE_CUSTOM_SEARCH_MAX_RETRIES: "-5",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 30_000);
      assert.equal(config.maxRetries, 3);
    },
  );
});

test("numeric overrides and the base override are honored when valid", () => {
  withEnv(
    {
      GOOGLE_CUSTOM_SEARCH_API_KEY: "key-1",
      GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS: "1000",
      GOOGLE_CUSTOM_SEARCH_MAX_RETRIES: "0",
      GOOGLE_CUSTOM_SEARCH_API_BASE: "https://example.test",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.timeoutMs, 1000);
      assert.equal(config.maxRetries, 0);
      assert.equal(config.apiBase, "https://example.test");
    },
  );
});
