# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Custom Search MCP

**English** | [Русский](./README.ru.md)

[![npm](https://img.shields.io/npm/v/mcp-google-custom-search)](https://www.npmjs.com/package/mcp-google-custom-search)
[![CI](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-custom-search/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-custom-search/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-custom-search)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Custom Search MCP** lets an AI app search the web and images in plain language through your [Programmable Search Engine](https://programmablesearchengine.google.com/). Ask for pages, narrow by language, country, date or site, page through results and pull image files with thumbnails.

It uses the Google Custom Search JSON API with your Google Cloud API key. You decide what the engine covers — a handful of sites or the entire web — and the server makes the limits of the JSON API explicit instead of implying that every search task is possible.

- **3 tools.** Web search, image search, and a raw GET escape hatch for parameters the typed tools don't expose.
- **Read-only end to end.** The Custom Search JSON API has no write endpoint; every tool is marked read-only and nothing here can modify data.
- **You control the coverage.** The engine's configuration decides what gets searched; results and ranking can differ from google.com.
- **The key stays in a header.** API-key authentication — no OAuth, no scopes; the key travels in the `X-Goog-Api-Key` header and never appears in a URL.
- **Not Google Search Console.** It cannot report how your own site is indexed or ranked.

Start with a read-only question:

> Find recent articles about passkey adoption from the last month and summarize the top three results.

[Connect the server](#quick-start) · [Explore use cases](#what-you-can-ask-it-to-do) · [Open technical documentation](#technical-documentation)

---

## See it work in a minute

> **You:** Find recent articles about passkey adoption, English only, from the last month.
>
> **Assistant:** Runs one search through your engine and shows each result's title, link and snippet. Nothing changes — every tool is read-only.
>
> **You:** Show the next page.
>
> **Assistant:** Continues from the `next_start` cursor and shows results 11–20 of the same query.
>
> **You:** Now find large press photos on the same topic.
>
> **Assistant:** Switches to image search and returns image files with their dimensions, thumbnails and the pages that host them.

## Contents

- [Quick start](#quick-start)
- [What you can ask it to do](#what-you-can-ask-it-to-do)
- [How a search works](#how-a-search-works)
- [What can change](#what-can-change)
- [Getting access](#getting-access)
- [Configuration](#configuration)
- [Data, limits and background work](#data-limits-and-background-work)
- [Technical documentation](#technical-documentation)
- [Support](#support)

## Quick start

You need Node.js 20+, a Google Cloud API key with the Custom Search API enabled and a Programmable Search Engine id (`cx`).

1. [Get an API key and an engine id](#getting-access).
2. Add the server to your AI app.
3. Ask the read-only question above.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**In the app:** open **Settings → MCP servers**, select **Add server**, choose **STDIO**, enter the command `npx -y mcp-google-custom-search@latest` and environment variables `GOOGLE_CUSTOM_SEARCH_API_KEY`, `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`, then select **Save** and **Restart**.

**From the command line:**

```bash
codex mcp add google-custom-search \
  --env GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key \
  --env GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id \
  -- npx -y mcp-google-custom-search@latest
```

```bash
codex mcp list
```

[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key \
  --env GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id \
  --transport stdio --scope user google-custom-search \
  -- npx -y mcp-google-custom-search@latest
```

```bash
claude mcp list
```

[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

The current official path is **Settings → Extensions**. For a custom desktop extension, open **Advanced settings → Extension Developer → Install Extension…**, select a `.mcpb` file and follow the prompts.

This repository currently publishes an npm stdio package and does not contain a `.mcpb` bundle. For Claude Desktop builds that still support local configuration, use the following JSON stdio configuration as a fallback:

```json
{
  "mcpServers": {
    "google-custom-search": {
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "your_api_key",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "your_engine_id"
      }
    }
  }
}
```

In those builds, save it to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

[Claude Desktop MCP documentation](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Add this to `~/.cursor/mcp.json` on macOS/Linux or `%USERPROFILE%\.cursor\mcp.json` on Windows:

```json
{
  "mcpServers": {
    "google-custom-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "your_api_key",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "your_engine_id"
      }
    }
  }
}
```

[Cursor MCP documentation](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Run **MCP: Open User Configuration** and add:

```json
{
  "servers": {
    "google-custom-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-google-custom-search@latest"],
      "env": {
        "GOOGLE_CUSTOM_SEARCH_API_KEY": "${input:custom_search_api_key}",
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID": "${input:custom_search_engine_id}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "custom_search_api_key", "description": "Google Cloud API key", "password": true },
    { "type": "promptString", "id": "custom_search_engine_id", "description": "Programmable Search Engine id (cx)" }
  ]
}
```

Check it with **MCP: List Servers**.

[VS Code MCP documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## What you can ask it to do

### Search the web

- Find recent tutorials on a topic and summarize the top results.
- Search only within `docs.python.org` — or everywhere except a site you distrust.
- Show the next page of results for the same query.

### Narrow the results

- Only English pages published in the last month.
- Only PDF files; require an exact phrase or exclude a term.
- Restrict to one country's content, or to material with specific usage rights.

### Find images

- Find large photos on a topic, with dimensions and thumbnails.
- Only clipart or line drawings, black and white ones.
- Show the page each image comes from.

### Go beyond the typed tools

- Call the API with parameters the typed tools don't expose — `fields` to trim the response, `lowRange`/`highRange`, `hq`.
- Fetch the raw response envelope with promotions and the full `pagemap`.

## How a search works

1. Every query runs through a **Programmable Search Engine**, identified by its `cx` id — the configured default or a per-call `engine_id`. The engine's configuration decides coverage: a list of specific sites, or the entire web when "Search the entire web" is enabled.
2. Results come back normalized — title, URL, snippet and metadata — with `next_start`/`previous_start` cursors for paging. `total_results` is Google's estimate and can shrink while paging.
3. The API returns at most 10 results per call and 100 per query (`start + num - 1` must stay ≤ 100). The server rejects a wider window before the request — the API would answer `400` after burning a quota unit.
4. Image search requires **Image search** enabled in the engine's control panel; otherwise the API answers `400`.

A `corrected_query` in the response is a spelling suggestion only — the results are still for the original query. And this is Programmable Search, not Google Search Console: the API cannot report how your own site is indexed or ranked.

## What can change

| Operation | What happens | Confirmation boundary |
|---|---|---|
| Web search (`search`) | Reads search results from your engine | No change |
| Image search (`search_images`) | Reads image results from your engine | No change |
| Raw API request (`raw_request`) | GET against any Custom Search API path | No change — the API has no write endpoint |

Every tool carries the read-only annotation, the escape hatch included. The Custom Search JSON API is a single GET endpoint with no writes, so the only thing a call spends is a unit of your daily quota.

## Getting access

Google Custom Search authenticates with an API key; no OAuth and no scopes are involved.

1. Create or select a Google Cloud project and enable the **Custom Search API**.
2. Create an **API key** under **APIs & Services → Credentials**. Restricting the key to the Custom Search API is a good habit.
3. Create a **Programmable Search Engine** in the [control panel](https://programmablesearchengine.google.com/controlpanel/create) and copy its **Search engine ID** (`cx`). Enable **Search the entire web** for open-web search and **Image search** for the image tool.

Treat the API key as a password. The server sends it in the `X-Goog-Api-Key` header, never in a URL, so logged or echoed URLs cannot leak it.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Yes | Google Cloud API key with the Custom Search API enabled. Secret. |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | Recommended | Default Programmable Search Engine id (`cx`); tools accept a per-call `engine_id` override. |
| `GOOGLE_CUSTOM_SEARCH_API_BASE` | No | Custom Search API base URL override. |
| `GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS` | No | Per-request timeout; default `30000` ms. |
| `GOOGLE_CUSTOM_SEARCH_MAX_RETRIES` | No | Transient-error retries (429/5xx/network); default `3`. |

Without credentials the server still starts and completes the MCP handshake; the first tool call explains exactly which variables to set. The one malformed setup is an engine id without an API key — the key cannot be supplied per call, so both must be set together.

## Data, limits and background work

- **Requests go to Google.** The local server calls the Custom Search JSON API. Its anonymous telemetry contains an installation ID, package version, AI client and platform versions, and tool names — never the API key, search queries, results or tool arguments. Set `ASKADS_TELEMETRY=0` to opt out.
- **Google applies a daily quota.** Every call from any of the three tools costs one unit of the per-project quota — 100 queries per day free, up to 10,000 per day with billing. On `429`, the server backs off honoring `Retry-After`; because the whole API is idempotent GETs, `5xx` and network errors are retried too, while `400`/`403` fail fast.
- **There is no background polling.** The server runs only when called. If your AI app supports scheduled tasks, it can rerun a search periodically — each run still spends quota units.

## Technical documentation

- [MCP capability catalog](./docs/capabilities/index.md) — task-oriented pages for every tool.
- [All tools and inputs](./docs/TOOLS.md)
- [Development documentation](./docs/DEVELOPMENT.md)
- [Publishing documentation](./docs/PUBLISHING.md)
- [Custom Search JSON API reference](https://developers.google.com/custom-search/v1/overview)

## Support

Found a bug or need a scenario? [Create an issue](https://github.com/A1-x-Tech/mcp-google-custom-search/issues) or write in [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  You made it to the end!
</p>
