# CLAUDE.md — mcp-google-custom-search

MCP server for the Google Custom Search JSON API (TypeScript, stdio). Read-only
end to end: `search` (web), `search_images` and the `raw_request` escape hatch
all hit the API's single GET endpoint `customsearch/v1` on
`https://customsearch.googleapis.com`. Auth is a static Google Cloud API key
sent in the `X-Goog-Api-Key` header (no OAuth, no scopes, no token refresh) plus
a Programmable Search Engine id (`cx`) — configured as the default engine or
passed per call as `engine_id`. The API has no write endpoint; nothing here can
modify data.

## Commands

```bash
npm run dev        # run from source (tsx watch)
npm test           # unit tests + dist smoke, no network
npm run typecheck  # types for src + tests
npm run build      # emit dist/
npm run smoke      # live READ-ONLY check: one 1-result search (argv/GOOGLE_CUSTOM_SEARCH_SMOKE_QUERY)
```

## Architecture

- `src/config.ts` — env → config. Credentials: `GOOGLE_CUSTOM_SEARCH_API_KEY` (the key —
  required for anything to work) + `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` (the default `cx`;
  addressing, not a credential — tools can override it per call); optional
  `GOOGLE_CUSTOM_SEARCH_API_BASE`, `GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS`,
  `GOOGLE_CUSTOM_SEARCH_MAX_RETRIES`. No credentials at all is NOT an error: the fields stay
  `undefined` and the server starts degraded. An engine id without a key throws `ConfigError`
  `incomplete_config` (the key cannot come per call, so that install can never work). Also home
  to `CredentialsError` / `MISSING_CREDENTIALS_MESSAGE` (names both variables and the restart),
  `EngineIdError` / `MISSING_ENGINE_ID_MESSAGE` (missing `cx`: fix per call via `engine_id` or
  via the env var + restart) and `hasCredentials()` (= the key is present).
- `src/client.ts` — all HTTP and all wire mapping. `apiKey()` throws `CredentialsError` before
  any fetch; `resolveEngineId()` prefers the per-call override and throws a typed `EngineIdError`
  (naming both the env var and the `engine_id` parameter) when neither exists; `request()`
  resolves the path against the base
  and rejects foreign origins (SSRF guard), sends the key in the `X-Goog-Api-Key` header (never
  the URL), fills in the configured `cx` when the path has none, enforces an AbortController
  timeout that also covers reading the body, retries 429 **and** 5xx/network errors with backoff
  honoring `Retry-After` in both RFC 9110 forms — delta-seconds and HTTP-date (every request is
  an idempotent GET — this API has no writes an ambiguous failure could duplicate) and throws
  `GoogleCustomSearchError(status, body)`. `buildSearchQuery()` /
  `buildImageSearchQuery()` map the normalized vocabulary to the wire parameters
  (`lr=lang_<code>`, `cr=country<CC>`, `siteSearchFilter` `i`/`e`, `filter` `0`/`1`, uppercase
  `imgSize`, `searchType=image`); `normalizeSearchResponse()` reduces the envelope to
  query/totals/cursors/items with title-url-snippet-metadata (pagemap only on request).
- `src/tools/search.ts` — `search`, plus the shared `searchInputFields()` schema factory and the
  `toSearchParams()` rename that `images.ts` reuses. `src/tools/images.ts` — `search_images`.
  `src/tools/raw.ts` — `raw_request` (GET only; the API has no other verbs).
  `src/tools/util.ts` — `ok`/`fail`, the four annotation presets
  (`READ_ONLY`/`WRITE`/`UPDATE`/`DESTRUCTIVE`; only `READ_ONLY` is in use — see conventions)
  shared zod schema factories (`querySchema`, `numSchema`, `startSchema`,
  `languageCodeSchema`, `countryCodeSchema`, `dateRestrictSchema`, `engineIdSchema`) and
  `checkPageWindow` (the cross-field `start + num - 1 <= 100` guard the flat zod shapes cannot
  express — called by both search tools before the client, so an impossible window never burns
  a quota unit on a guaranteed 400).
- `src/index.ts` — wires every `register*` into the McpServer. `loadConfigOrDegraded()` catches
  `ConfigError`, pings `startup_failed` (fire-and-forget) and degrades the config to "no
  credentials"; an unconfigured start prepends `UNCONFIGURED_PREFIX` — plus
  `Configuration problem: <message>` when a ConfigError was caught — to the initialize
  `instructions`, and `oninitialized` sends `server_start` for a configured install or
  `unconfigured_start` (with the reason) otherwise.
- `src/telemetry.ts` — anonymous usage pings (ids/names/versions only, never queries, results
  or arguments; fire-and-forget, must never block or throw; opt-out `ASKADS_TELEMETRY=0`).
  `server_start` means "a usable install started"; `unconfigured_start` is a degraded start and
  `startup_failed` a malformed config caught at load — both carry a `reason` from a closed
  vocabulary (`missing_credentials`, `incomplete_config`) — never a variable's name or value.

## Conventions (do not break)

- **Never exit because of configuration.** A server that dies before the MCP handshake leaves
  the user with a red cross and no reason — telemetry across this line of servers showed that
  state accounted for nearly every unconfigured install, and almost none of them recovered.
  Missing credentials are a survivable state: start, answer initialize (with the unconfigured
  prefix in `instructions`) and tools/list, and let the first tool call fail with
  `CredentialsError` — its message names the variables to set and says to restart, because
  credentials come only from the environment. `config.test.ts`, `client.test.ts` and
  `test/dist-smoke.test.js` pin this.
- **Credential failures are not transport failures.** `CredentialsError` is thrown in
  `apiKey()` before any fetch — before the retry/backoff loop — because retrying it burns
  seconds of backoff before the user sees the one message that helps. The missing key also
  outranks a missing engine id: `search()`/`searchImages()` check credentials before
  addressing. Pinned by the "fetch never called" assertions in `client.test.ts`.
- **The key never enters a URL.** It travels in the `X-Goog-Api-Key` header, so logged or
  echoed URLs (and the SSRF error message) cannot leak it; timeout messages carry the path
  without its query string. Pinned in `client.test.ts` and `test/dist-smoke.test.js`.
- **5xx/network retries are safe here only because the API is read-only.** The whole surface is
  idempotent GETs, so `request()` retries 429 and 5xx/network alike. If Google ever grows a
  write endpoint on this API, the template rule returns: 429 only for writes — never replay a
  write after an ambiguous failure.
- **No write tool, ever.** The Custom Search JSON API cannot modify anything; don't fake it.
- **Wire mapping lives in the client, not the tools.** Tools accept the normalized snake_case
  vocabulary and must not know the wire params (`lr`/`gl`/`cr`/`hl`, `i`/`e`, `0`/`1`,
  uppercase `imgSize`, `searchType`) — add any mapping in `client.ts`.
- **Auth is the client's job.** Tools never see the key; the header, the credentials check and
  the cx fill-in all live in `request()`/`apiKey()`.
- **Validate inputs with zod** in `inputSchema`; reuse the shared schema **factories** in
  `util.ts` (a fresh schema per field avoids `$ref` dedup in the JSON schema).
- **Annotations are pinned per tool** in `annotations.test.ts` — changing one is a conscious
  decision that updates the map, with all four hints always set. Every tool here is
  `READ_ONLY`; a non-read-only tool appearing would mean the server started doing something
  this API cannot do.
- **Output compact JSON via `ok`** — the consumer is an LLM; pretty-printing burns tokens.
  The client normalizes the envelope to title/url/snippet/metadata (describe the fields in the
  tool `description`, the only place the external model reads); `raw_request` alone passes the
  envelope through verbatim.

## Adding a tool

Before changing the tool registry, read [the MCP capability documentation contract](docs/CAPABILITY-DOCUMENTATION.md). Every registered tool must have exactly one task-oriented page in `docs/capabilities/`; update that page, the index, and the coverage test in the same change.

1. Add (or extend) `src/tools/<name>.ts` with `register<Name>Tools(server, client)`.
2. If it needs new wire parameters, add the mapping to `src/client.ts`.
3. Import and call the register fn in `src/index.ts`.
4. Add a `*.test.ts` using the mock-fetch (client) / fake-client (tools) harness — no
   network — and add the tool + hints to `annotations.test.ts` and `test/dist-smoke.test.js`.
5. `npm run typecheck && npm test`.

## Releasing

Keep the version in sync across **all** channels in one go (`git push --follow-tags` pushes
the tag but does **not** create a GitHub Release; the registry is immutable per version):

1. Bump `version` in **three places, identically**: `package.json`, and in `server.json`
   **both** the root `version` **and** `packages[0].version`. `mcpName` in `package.json` must
   match `name` in `server.json` (`io.github.A1-x-Tech/mcp-google-custom-search`). Verify:
   `grep -n '"version"' package.json server.json`.
   > ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. A stale root makes
   > `mcp-publisher publish` fail with a misleading `400 cannot publish duplicate version`
   > while `npm publish` succeeds.
2. Update `CHANGELOG.md`, then `npm publish` (runs typecheck + tests + build via
   `prepublishOnly` / `prepare`).
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:** `mcp-publisher publish` (login with
   `mcp-publisher login github --token "$(gh auth token)"`).
