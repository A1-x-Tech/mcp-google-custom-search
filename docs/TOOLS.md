# Tools

For task-oriented guidance, open the [MCP capability catalog](./capabilities/index.md). This page remains the technical reference for schemas and API responses.

The Custom Search JSON API is read-only end to end — one GET endpoint, no writes — so every tool carries the `READ_ONLY` annotation, `raw_request` included. Inputs use a normalized snake_case vocabulary; the client maps them to the API's wire values (`lr=lang_<code>`, `cr=country<CC>`, the `i`/`e` site-search filter, the `0`/`1` duplicate filter, uppercase `imgSize`) and attaches the API key entirely on its own — in the `X-Goog-Api-Key` header, never in the URL.

The engine id (`cx`) identifies which Programmable Search Engine to search through: the configured `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` is the default, `engine_id` overrides it per call.

## Search

| Tool | Description |
|---|---|
| `search` | Web search. Returns the normalized shape: `query`, `total_results` (Google's estimate — it can shrink while paging), `search_time_seconds`, `corrected_query` (spelling suggestion; the results are still for the original query), `next_start` / `previous_start` page cursors, and `items[]` with `title`, `url`, `display_link`, `snippet`, `mime` / `file_format` and (with `include_pagemap`) the raw `pagemap`. Filters: `safe`, `language` (`lr`), `country` (`gl`, ranking bias) vs `country_restrict` (`cr`, hard filter), `interface_language` (`hl`), `site_search` + `site_search_filter`, `date_restrict` (`d7` / `w2` / `m6` / `y1`), `exact_terms`, `exclude_terms`, `or_terms`, `file_type`, `rights`, `sort`, `filter_duplicates`. |
| `search_images` | The same query with `searchType=image` plus image-only filters: `size` (`icon`..`huge` → uppercase wire enum), `type`, `color_type`, `dominant_color`. Each item's `url` is the image file; `image` carries `context_url` (hosting page), `width` / `height` / `byte_size` and `thumbnail_url` (+ its dimensions). Requires **Image search** enabled in the engine — otherwise the API answers 400. |

## Escape hatch

| Tool | Description |
|---|---|
| `raw_request` | GET any Custom Search API path directly, e.g. `customsearch/v1?q=test&num=3&fields=items(title,link)` — for parameters the typed tools don't expose (`lowRange`/`highRange`, `c2coff`, `hq`, `fields`) and for the raw envelope (`promotions`, `htmlSnippet`, full `pagemap`). The key is added in a header automatically; the configured `cx` is filled in when the path has none (an explicit `cx` wins). A path resolving to a foreign origin is rejected (SSRF guard), so the key never leaves `customsearch.googleapis.com`. |

## Notes

- **Paging ceiling:** at most 10 results per call (`num`) and 100 results per query — `start + num - 1` must stay ≤ 100. `search`/`search_images` reject a wider window before the request (the API would answer 400 after burning a quota unit). Paginate with `next_start`.
- **Quota:** every call (all three tools) costs one unit of the per-project daily quota — 100 queries/day free, up to 10,000/day with billing. HTTP 429 means the quota or rate limit is exhausted.
- **Retry policy:** 429 and — because the whole API is idempotent GETs with no writes to duplicate — 5xx/network errors are retried with exponential backoff (honoring `Retry-After` in both RFC 9110 forms, delta-seconds and HTTP-date); 400/403 fail fast.
- **Auth:** a static API key in the `X-Goog-Api-Key` header. No OAuth, no scopes, no token refresh — a 401/403 is terminal and surfaces as a normalized `GoogleCustomSearchError`.
- **Coverage is the engine's configuration:** an engine listing specific sites searches only those; open-web search needs "Search the entire web" enabled in the [control panel](https://programmablesearchengine.google.com/controlpanel/all). Results and ranking can differ from google.com.
- **Not Google Search Console:** this API cannot report how your own site is indexed or ranked.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | yes | — | Google Cloud API key with the Custom Search API enabled. Secret. |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | recommended | — | Default Programmable Search Engine id (`cx`). Tools accept a per-call `engine_id` override. |
| `GOOGLE_CUSTOM_SEARCH_API_BASE` | no | `https://customsearch.googleapis.com` | API root override. |
| `GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS` | no | `30000` | Per-request timeout, ms. |
| `GOOGLE_CUSTOM_SEARCH_MAX_RETRIES` | no | `3` | Retries on transient errors (429/5xx/network). |
