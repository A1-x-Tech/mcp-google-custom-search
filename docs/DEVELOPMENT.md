# Development

## Requirements

- Node.js 20+ (the published package ships compiled `dist/`; `npx` needs no separate
  install). CI runs the suite on Node 20, 22 and 24.

## Commands

```bash
npm install
npm run dev        # run from source with tsx watch
npm test           # unit tests (node:test) + dist smoke, no network
npm run typecheck  # type-check src + tests (no emit)
npm run build      # clean dist/ and compile with tsc
npm run smoke      # live READ-ONLY check (see below)
```

## Local run

```bash
npm run build
GOOGLE_CUSTOM_SEARCH_API_KEY=... GOOGLE_CUSTOM_SEARCH_ENGINE_ID=... node dist/index.js
# optional: GOOGLE_CUSTOM_SEARCH_API_BASE, GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS, GOOGLE_CUSTOM_SEARCH_MAX_RETRIES
```

`npm run smoke` is the opt-in live check: it needs real credentials in the environment and
makes exactly one 1-result web search (query from the first argv or
`GOOGLE_CUSTOM_SEARCH_SMOKE_QUERY`, default "model context protocol"), burning one unit of the
daily quota. The Custom Search API is read-only, so the check creates no resources and needs
no cleanup — on success or on failure.

## Tests

Unit tests mock `globalThis.fetch` (client) or use a fake server + fake client (tools), so
the whole suite runs offline. `test/dist-smoke.test.js` additionally spawns the built
`dist/index.js` and performs a real MCP handshake over stdio through the official SDK,
asserting the server identity, the instructions and the full tool list — including the
degraded start without credentials. Put a `*.test.ts` next to the code it covers;
`npm run typecheck && npm test` is the gate (also run by `prepublishOnly`).

## Usage telemetry

The server sends anonymous events to `usage.gistrec.cloud` (`server_start` when a client
connects to a configured install, `unconfigured_start` when a client connects to a server
without credentials, `tool_call` with the tool **name**, and `startup_failed` with a
fixed-vocabulary reason code when the configuration is malformed) to count active installs
and tool demand. An event carries only impersonal technical fields: a random installation id
(`~/.config/mcp-google-custom-search/instance-id`), the package version, the AI client's name
and version from the MCP handshake, the Node.js version and the OS.

The API key, search queries, results, tool arguments and prompts are never sent or stored
(implementation: `src/telemetry.ts`). Sends run in the background with a 2 s timeout and are
silently skipped on any error. Opt out for all servers of this line at once:
`ASKADS_TELEMETRY=0`.
