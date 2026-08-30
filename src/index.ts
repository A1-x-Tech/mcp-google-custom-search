#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleCustomSearchClient } from "./client.js";
import { ConfigError, DEFAULT_BASE, hasCredentials, loadConfig } from "./config.js";
import { instrumentToolCalls, Telemetry } from "./telemetry.js";
import type { GoogleCustomSearchConfig } from "./types.js";
import { registerSearchTools } from "./tools/search.js";
import { registerImageTools } from "./tools/images.js";
import { registerRawTool } from "./tools/raw.js";

/**
 * Prose handed to the calling model in the `initialize` result — the only place
 * it learns what the tool list cannot say: which Google product this API is,
 * what the API refuses to do, and the behaviours that make a naive loop
 * expensive, lossy or misleading.
 */
const INSTRUCTIONS =
  "Google Custom Search JSON API searches the web through a Programmable Search Engine — it is NOT " +
  "Google Search Console (no indexing or ranking data about your own site) and not the google.com " +
  "results page: coverage and ranking come from the engine's configuration, and open-web search only " +
  'works when "Search the entire web" is enabled in its control panel. The whole API is read-only ' +
  "GETs — nothing a tool here does can modify data. Hard limits: 10 results per call, 100 results " +
  "per query total (start + num - 1 <= 100; a wider window is rejected before the API is called, " +
  "since the API would answer 400 after burning a quota unit) — paginate with " +
  "next_start, and treat total_results as Google's estimate, not a promise. Every call, search_images " +
  "and raw_request included, burns one unit of the per-project daily quota (100/day free, up to " +
  "10k/day billed) — one precise query with operators beats several broad ones, and HTTP 429 means " +
  "the quota or rate limit is exhausted: stop, don't hammer. search_images needs Image search " +
  "enabled in the engine (a 400 otherwise). A 403 is the key (API not enabled, referrer/IP " +
  "restrictions), a 400 usually a parameter or the cx. Empty items with a nonzero total_results " +
  "happens on far pages — the estimate shrank; back off to earlier pages.";

/**
 * Prepended to INSTRUCTIONS when no credentials are configured. The model reads
 * this before it picks a tool, so an unconfigured session opens with the fix
 * rather than with a failed call. There is no in-chat login here: credentials
 * come only from the environment, so the fix is an operator action + restart.
 */
const UNCONFIGURED_PREFIX =
  "ATTENTION: Google Custom Search is not connected yet — no API key is configured, so every " +
  "tool call will fail. The operator must set GOOGLE_CUSTOM_SEARCH_API_KEY (a Google Cloud API " +
  "key with the Custom Search API enabled) and GOOGLE_CUSTOM_SEARCH_ENGINE_ID (the Programmable " +
  "Search Engine cx id) in the MCP client's server config and restart this server — the " +
  "variables are read only at startup. ";

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
  config: GoogleCustomSearchConfig;
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
      config: { apiBase: process.env.GOOGLE_CUSTOM_SEARCH_API_BASE || DEFAULT_BASE },
      problem: err,
    };
  }
}

async function main(): Promise<void> {
  // Anonymous usage pings (ids/names/versions only, never queries or results);
  // opt out with ASKADS_TELEMETRY=0. Built before the config so missing
  // credentials can be reported; wired to the server before tools register.
  const telemetry = new Telemetry(readVersion());
  const { config, problem } = loadConfigOrDegraded(telemetry);
  const client = new GoogleCustomSearchClient(config);

  // Decided once, at startup: credentials come only from the environment, so
  // "restart after setting the variables" is the accurate advice to give.
  const connected = hasCredentials(config);

  const server = new McpServer(
    {
      name: "mcp-google-custom-search",
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

  registerSearchTools(server, client);
  registerImageTools(server, client);
  registerRawTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-google-custom-search running on stdio${connected ? "" : " (no credentials — set the environment variables and restart)"}`,
  );
}

main().catch((err) => {
  console.error("Fatal error starting mcp-google-custom-search:", err);
  process.exit(1);
});
