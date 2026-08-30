# Google Custom Search: Raw Custom Search API call — MCP tool

**Google Custom Search MCP tool:** Escape hatch — a GET against any Custom Search JSON API path, returning the raw response envelope for parameters and fields the typed tools don't expose.

Technical name: `raw_request`

## What task it solves

> I want to call the Custom Search JSON API directly when the typed search tools don't expose the parameter or the response field I need.

Performs a GET against a Custom Search API path (e.g. `customsearch/v1?q=test&num=3`) and returns the raw, unnormalized response: `queries.request`/`nextPage`, `searchInformation`, `promotions`, `context`, and `items[]` with `htmlSnippet`, `htmlTitle`, `formattedUrl` and the full `pagemap`.

## When to use it

Use it for parameters the typed tools deliberately leave out — `lowRange`/`highRange`, `c2coff`, `hq`, a `fields` projection to trim the response — or when you need the raw envelope itself (promotions, HTML-formatted snippets). For everyday searching prefer [search](./search.md) and [search-images](./search-images.md): they return the compact normalized shape.

## What to provide

- `path` — **required**. The API path with its query string, relative to `https://customsearch.googleapis.com`, e.g. `customsearch/v1?q=hello&num=3&fields=items(title,link)`.

The API key is attached automatically (in a request header, never the URL), and the configured engine id is filled in when the path carries no `cx` parameter — an explicit `cx` in the path wins.

## What it returns

The raw JSON envelope exactly as the API sent it, or a clear MCP error. Nothing is normalized or trimmed unless you pass a `fields` projection yourself.

## What changes in Google Custom Search

Nothing. The Custom Search JSON API consists of GET endpoints only, so even this escape hatch cannot modify data — which is why the tool is annotated read-only. Each call still consumes one unit of the daily quota.

## Example request

> Call customsearch/v1 with q="model context protocol", num=3 and a fields projection that keeps only items' titles and links.

## Errors and limitations

- A path resolving to a foreign origin is rejected before any network call (SSRF guard) — the API key can never leave `customsearch.googleapis.com`.
- The same limits as every other tool: 10 results per call, 100 per query, one quota unit per call, HTTP 429 on quota exhaustion.
- `customsearch/v1/siterestrict` is deprecated by Google and may not work.

Access also depends on key restrictions, quotas, and upstream API limits.

## Related MCP tools

- [Search the web](./search.md) — `search`
- [Search for images](./search-images.md) — `search_images`

## Technical details

- **Impact:** read-only
- **Group:** Additional API methods
- **Description source:** `raw_request` registration in `src/tools/raw.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
