import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleCustomSearchClient } from "../client.js";
import { registerRawTool } from "./raw.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

/** Registers raw_request against a real client with a recording fetch stub. */
function harness() {
  const original = globalThis.fetch;
  const calls: { url: string; method: string; key: unknown }[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as { method: string; headers?: Record<string, string> };
    calls.push({ url: String(url), method: i.method, key: i.headers?.["X-Goog-Api-Key"] });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const client = new GoogleCustomSearchClient({
    apiKey: "TKN",
    engineId: "cx-default",
    apiBase: "https://customsearch.googleapis.com",
    maxRetries: 0,
  });
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, h: Handler) => {
      tools[name] = h;
    },
  };
  registerRawTool(server as never, client);
  return {
    tools,
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("raw_request GETs the path with the key in a header and the default cx filled in", async () => {
  const { tools, calls, restore } = harness();
  try {
    const res = await tools.raw_request({ path: "customsearch/v1?q=hello&num=3" });
    assert.equal(res.isError, undefined);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].key, "TKN");
    const url = new URL(calls[0].url);
    assert.equal(url.origin + url.pathname, "https://customsearch.googleapis.com/customsearch/v1");
    assert.equal(url.searchParams.get("q"), "hello");
    assert.equal(url.searchParams.get("cx"), "cx-default");
    assert.ok(!calls[0].url.includes("TKN"), "the key must never be in the URL");
  } finally {
    restore();
  }
});

test("raw_request keeps an explicit cx from the path", async () => {
  const { tools, calls, restore } = harness();
  try {
    await tools.raw_request({ path: "customsearch/v1?q=hello&cx=cx-mine" });
    assert.equal(new URL(calls[0].url).searchParams.get("cx"), "cx-mine");
  } finally {
    restore();
  }
});

test("raw_request rejects an absolute path as an isError result, without fetching", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const { tools, calls, restore } = harness();
    try {
      const res = await tools.raw_request({ path: evil });
      assert.equal(res.isError, true, `${JSON.stringify(evil)} should be isError`);
      assert.match(res.content[0].text, /foreign origin/);
      assert.equal(calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      restore();
    }
  }
});
