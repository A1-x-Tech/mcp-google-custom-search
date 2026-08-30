# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Custom Search MCP

[![CI](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

MCP server (stdio) for the **Google Custom Search JSON API**: web and image search through a
[Programmable Search Engine](https://programmablesearchengine.google.com/), with pagination,
language/country filters, safe search and structured results (title, URL, snippet, metadata).
Read-only end to end — the API has no write endpoint. This is Programmable Search, **not**
Google Search Console: it cannot report how your own site is indexed or ranked.

> This is the technical README for the development handoff; the full public README,
> marketing copy and store listings are a follow-up task.

## Tools

| Tool | Impact | Purpose |
|---|---|---|
| `search` | read-only | Web search: normalized items + `next_start`/`previous_start` paging cursors, filters (`safe`, `language`, `country` vs `country_restrict`, `site_search`, `date_restrict`, `file_type`, `rights`, ...). |
| `search_images` | read-only | Image search (`searchType=image`, requires Image search enabled in the engine): image URL, dimensions, thumbnail, hosting page; extra filters `size`/`type`/`color_type`/`dominant_color`. |
| `raw_request` | read-only | Escape hatch: GET any Custom Search API path for parameters/fields the typed tools don't expose; returns the raw envelope. |

Details: [docs/TOOLS.md](./docs/TOOLS.md) · task-oriented pages: [docs/capabilities/](./docs/capabilities/index.md).

## Setup

1. In a Google Cloud project, enable the **Custom Search API** and create an **API key**.
2. Create a **Programmable Search Engine** at
   [programmablesearchengine.google.com](https://programmablesearchengine.google.com/controlpanel/create)
   and copy its **Search engine ID** (`cx`). Enable "Search the entire web" for open-web
   search and "Image search" for `search_images`.
3. Add the server to your MCP client:

```json
{
  "mcpServers": {
    "google-custom-search": {
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "<api key>",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "<cx>"
      }
    }
  }
}
```

Without credentials the server still starts and completes the MCP handshake (degraded mode):
the initialize instructions and the first tool call explain exactly which variables to set.
No OAuth is involved — the JSON API authenticates with the API key alone, so there are no
scopes to grant; the key is sent in a request header, never in a URL.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | yes | — | API key (Custom Search API enabled). Secret. |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | recommended | — | Default engine id (`cx`); tools accept a per-call `engine_id`. |
| `GOOGLE_CUSTOM_SEARCH_API_BASE` | no | `https://customsearch.googleapis.com` | API root override. |
| `GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS` | no | `30000` | Per-request timeout, ms. |
| `GOOGLE_CUSTOM_SEARCH_MAX_RETRIES` | no | `3` | Retries on 429/5xx/network errors. |

## Limits to know

- **10 results per call, 100 per query** (`start + num - 1 ≤ 100`) — the API's hard ceiling; a wider window is rejected before the call, saving the quota unit a 400 would burn.
- **Quota:** every call costs one unit — 100 queries/day free, up to 10,000/day with billing.
  HTTP 429 = quota/rate limit exhausted.
- Coverage and ranking come from the engine's configuration and can differ from google.com.

## Development

```bash
npm install
npm run typecheck && npm test   # offline: unit tests + dist smoke over a real MCP handshake
npm run smoke                   # opt-in live check (1 read-only query, needs real credentials)
```

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) (incl. the telemetry contract and the
`ASKADS_TELEMETRY=0` opt-out) and [docs/PUBLISHING.md](./docs/PUBLISHING.md).

## License

[MIT](./LICENSE) © A1 x Tech
