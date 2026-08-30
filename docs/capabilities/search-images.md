# Google Custom Search: Search for images — MCP tool

**Google Custom Search MCP tool:** Image search through your Programmable Search Engine — results carry the image file URL, dimensions, a thumbnail and the hosting page, filterable by size, type, color and license.

Technical name: `search_images`

## What task it solves

> I want to find images on the web — by subject, size, type, color or license — from my AI session.

Runs the same Custom Search query as [search](./search.md) with `searchType=image`. Each item's `url` is the image file itself; `image.context_url` is the page hosting it, alongside `width`/`height`/`byte_size` and a `thumbnail_url` with its own dimensions for previews.

## When to use it

Use it to find illustrations, product photos, logos or reference images — especially with the `rights` filter when the image must be reusable (e.g. `cc_publicdomain`). It works only when the engine has **Image search** enabled in the [engine control panel](https://programmablesearchengine.google.com/controlpanel/all); otherwise the API answers 400.

## What to provide

- `query` — **required**.
- Image filters, all optional: `size` (`icon`..`huge`), `type` (`clipart`/`face`/`lineart`/`stock`/`photo`/`animated`), `color_type` (`mono`/`gray`/`color`/`trans`), `dominant_color`.
- Everything the web search accepts also works here: pagination (`num`, `start`), `safe`, `language`/`country` filters, `site_search` + `site_search_filter`, `date_restrict`, `file_type` (e.g. `svg`), `rights`, `engine_id`.

## What it returns

The same normalized shape as the web search — `query`, `total_results`, page cursors and `items[]` — where every item additionally carries the `image` object (context URL, dimensions, byte size, thumbnail). `mime` tells the image format.

## What changes in Google Custom Search

Nothing. This is a pure read; the API cannot modify anything. Each call consumes one unit of the same per-project daily quota as the web search.

## Example request

> Find large, transparent-background PNG or SVG icons of a paper plane with a license that allows reuse, and show thumbnails and source pages.

## Errors and limitations

- HTTP 400 with image parameters usually means the engine has Image search disabled — enable it in the control panel.
- The same paging ceiling as web search: 10 per call, 100 per query.
- The `rights` filter relies on how pages declare licenses — verify the license on the source page before using an image.
- HTTP 429 is the daily quota or rate limit; HTTP 403 is the key or a disabled API.

Access also depends on key restrictions, quotas, and upstream API limits.

## Related MCP tools

- [Search the web](./search.md) — `search`
- [Raw Custom Search API call](./raw-request.md) — `raw_request`

## Technical details

- **Impact:** read-only
- **Group:** Search
- **Description source:** `search_images` registration in `src/tools/images.ts`
- [Full technical reference](../TOOLS.md)
- [All MCP capabilities](./index.md)
