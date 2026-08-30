import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { GoogleCustomSearchClient } from "../dist/client.js";
import { registerSearchTools } from "../dist/tools/search.js";
import { registerImageTools } from "../dist/tools/images.js";
import { registerRawTool } from "../dist/tools/raw.js";

const ALL_TOOLS = ["raw_request", "search", "search_images"];

test("dist client rejects foreign-origin paths before sending the API key", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const client = new GoogleCustomSearchClient({
      apiKey: "SECRET",
      engineId: "cx-1",
      apiBase: "https://customsearch.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    await assert.rejects(() => client.request("https://example.invalid/steal"), /foreign origin/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("dist client sends the key in a header, never the URL", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), key: init.headers["X-Goog-Api-Key"] };
    return new Response(
      JSON.stringify({
        queries: { request: [{ searchTerms: "smoke", totalResults: "1" }] },
        searchInformation: { totalResults: "1", searchTime: 0.1 },
        items: [{ title: "T", link: "https://example.com", displayLink: "example.com", snippet: "s" }],
      }),
      { status: 200 },
    );
  };
  try {
    const client = new GoogleCustomSearchClient({
      apiKey: "SECRET",
      engineId: "cx-1",
      apiBase: "https://customsearch.googleapis.com",
      timeoutMs: 1000,
      maxRetries: 0,
    });
    const result = await client.search({ query: "smoke" });
    const url = new URL(seen.url);
    assert.equal(url.origin + url.pathname, "https://customsearch.googleapis.com/customsearch/v1");
    assert.equal(url.searchParams.get("q"), "smoke");
    assert.equal(url.searchParams.get("cx"), "cx-1");
    assert.equal(seen.key, "SECRET");
    assert.ok(!seen.url.includes("SECRET"), "the key must never be in the URL");
    assert.equal(result.items[0].url, "https://example.com");
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

  registerSearchTools(server, client);
  registerImageTools(server, client);
  registerRawTool(server, client);

  assert.deepEqual(names.sort(), ALL_TOOLS);
});

test("dist binary completes a real MCP handshake over stdio and lists every tool", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: {
      ...process.env,
      GOOGLE_CUSTOM_SEARCH_API_KEY: "test-key",
      GOOGLE_CUSTOM_SEARCH_ENGINE_ID: "test-cx",
      ASKADS_TELEMETRY: "0", // keep the suite offline
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "dist-smoke", version: "0.0.0" });
  await client.connect(transport);
  try {
    const server = client.getServerVersion();
    assert.equal(server?.name, "mcp-google-custom-search");
    assert.match(String(server?.version), /^\d+\.\d+\.\d+$/);

    // The instructions the calling model reads before it picks any tool.
    const instructions = client.getInstructions();
    assert.equal(typeof instructions, "string");
    assert.ok(instructions.trim().length > 0, "initialize result carries no instructions");
    assert.match(instructions, /Custom Search JSON API/);
    assert.match(instructions, /Search Console/, "the Search Console distinction must reach the model");

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    const search = tools.find((t) => t.name === "search");
    assert.equal(search.annotations?.readOnlyHint, true);
    assert.ok(search.inputSchema?.properties?.query, "input schema must reach the client");
  } finally {
    await client.close();
  }
});

/**
 * The degraded-start contract: without any credentials the binary must not
 * exit before the handshake. It must start, list every tool, open the
 * instructions with the fix, and answer a tool call with the actionable
 * error — offline: the CredentialsError fires before any fetch, so this test
 * never touches the network.
 */
test("dist binary starts without credentials: handshake, tool list, actionable call error", async () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("GOOGLE_CUSTOM_SEARCH_"),
    ),
  );
  env.ASKADS_TELEMETRY = "0"; // keep the suite offline
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
    assert.match(instructions, /not connected/);
    assert.match(instructions, /GOOGLE_CUSTOM_SEARCH_API_KEY/);
    assert.match(instructions, /restart/);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ALL_TOOLS);

    // A tool call fails with the exact message instead of killing the server.
    const result = await client.callTool({ name: "search", arguments: { query: "smoke" } });
    assert.equal(result.isError, true);
    const text = result.content.map((c) => c.text ?? "").join(" ");
    assert.match(text, /A Google API key is required: set GOOGLE_CUSTOM_SEARCH_API_KEY/);
    assert.match(text, /restart the server/);
  } finally {
    await client.close();
  }
});
