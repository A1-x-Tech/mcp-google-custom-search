# Google Custom Search MCP capabilities

This catalog contains 3 public pages—one for every registered MCP tool in `mcp-google-custom-search`. Each page starts with the user's task, explains the result, and states whether the call changes real data (here: never — the Custom Search JSON API is read-only end to end).

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Search

- [Search the web](./search.md) — Web search through your Programmable Search Engine: structured results with title, URL, snippet and metadata, plus pagination, language/country filters and safe search. **Impact:** read-only.
- [Search for images](./search-images.md) — Image search (searchType=image) with size, type, color and license filters; each result carries the image file URL, its dimensions and a thumbnail. **Impact:** read-only.

## Additional API methods

- [Raw Custom Search API call](./raw-request.md) — Escape hatch: a GET against any Custom Search JSON API path, returning the raw response envelope for parameters the typed tools don't expose. **Impact:** read-only.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-custom-search)
