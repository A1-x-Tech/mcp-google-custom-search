# Google Custom Search: Search the web — MCP tool

**Google Custom Search MCP tool:** Web search through your Programmable Search Engine — structured results with title, URL, snippet and metadata, plus pagination, language/country filters and safe search.

Technical name: `search`

## What task it solves

> I want to search the web and get structured, filterable results into my AI session.

Runs one query against the Google Custom Search JSON API through your Programmable Search Engine (`cx`) and returns a normalized result: the query, Google's `total_results` estimate, the search time, a spelling suggestion when Google has one, ready-to-use `next_start`/`previous_start` page cursors, and `items[]` with `title`, `url`, `display_link`, `snippet`, `mime`/`file_format` and — on request — the page's `pagemap` metadata.

## When to use it

Use it whenever the session needs live web results: research, fact checking, finding documentation or sources, monitoring what is published about a topic. Coverage is your engine's configuration — an engine listing specific sites searches only those; open-web search needs "Search the entire web" enabled in the [engine control panel](https://programmablesearchengine.google.com/controlpanel/all).

Do not use it to inspect how your own site performs in Google — that is Google Search Console, a different product this API cannot reach.

## What to provide

- `query` — **required**. The search query; Google operators (quotes, `site:`, `filetype:`, `OR`, `-exclusions`) work.
- Pagination: `num` (1..10 per page) and `start` (pass `next_start` from the previous page; the API serves at most 100 results per query).
- Filters, all optional: `safe` (`active`/`off`), `language` (e.g. `de`), `country` (ranking bias) vs `country_restrict` (hard filter), `interface_language`, `site_search` + `site_search_filter` (`include`/`exclude`), `date_restrict` (`d7`, `m6`, `y1`, ...), `exact_terms`, `exclude_terms`, `or_terms`, `file_type`, `rights` (license), `sort` (`date`), `filter_duplicates`.
- `include_pagemap` — attach each result's raw structured page metadata (verbose).
- `engine_id` — a `cx` override when one server should search through several engines.

## What it returns

Compact JSON: `query`, `total_results` (an estimate that can shrink while paging), `search_time_seconds`, `corrected_query` (suggestion only — the results are still for the original spelling), `next_start`/`previous_start`, and `items[]` as described above. An empty `items` with a nonzero `total_results` on far pages means the estimate shrank — go back to earlier pages.

## What changes in Google Custom Search

Nothing. The tool reads search results and does not change any data; the Custom Search JSON API has no write endpoint at all. Each call does consume one unit of the per-project daily quota (100 queries/day free, up to 10,000/day billed).

## Example request

> Search the web for recent PDF reports about battery recycling in Germany — German results from the last year, and give me titles, links and snippets.

## Errors and limitations

- 10 results per call, 100 per query maximum: `start + num - 1` must stay ≤ 100 — a wider window is rejected before the request (the API would answer 400 after burning a quota unit).
- HTTP 429 — daily quota or rate limit exhausted; retrying past the built-in backoff will not help.
- HTTP 403 — the key: Custom Search API not enabled in the Cloud project, or the key's referrer/IP restrictions block the server.
- HTTP 400 — usually a bad parameter or a wrong `cx`.
- Results and ranking come from the engine configuration and can differ from google.com.

Access also depends on key restrictions, quotas, and upstream API limits.

## Related MCP tools

- [Search for images](./search-images.md) — `search_images`
- [Raw Custom Search API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** read-only
- **Group:** Search
- **Description source:** `search` registration in `src/tools/search.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
