# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-08-30

### Added

- Initial release: MCP server (stdio) for the Google Custom Search JSON API.
- Tools: `search` (web search with pagination, language/country filters, safe search,
  site/date/file-type/license filters and structured title-URL-snippet-metadata results),
  `search_images` (searchType=image with size/type/color/dominant-color filters and image
  metadata incl. thumbnails) and `raw_request` (GET escape hatch returning the raw envelope).
  All three are read-only — the API has no write endpoint.
- API-key auth in the `X-Goog-Api-Key` header (never in URLs), default engine id from
  `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` with a per-call `engine_id` override.
- Degraded start without credentials: the server completes the MCP handshake, lists tools,
  opens the initialize instructions with the fix and fails the first tool call with an
  actionable `CredentialsError` instead of exiting.
- Timeouts (AbortController, covering the body read), retries with exponential backoff and
  Retry-After (429 and — the API being idempotent GETs only — 5xx/network), SSRF guard on
  raw paths, normalized Google API errors.
- Anonymous usage telemetry (`server_start` / `unconfigured_start` / `tool_call` /
  `startup_failed`; opt-out `ASKADS_TELEMETRY=0`).
- Offline test suite (config, client, every tool, annotations, capability-docs coverage) plus
  a dist smoke test with a real MCP handshake, and an opt-in live read-only `npm run smoke`.
