import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCustomSearchClient } from "../client.js";
import { fail, ok, READ_ONLY } from "./util.js";

export function registerRawTool(server: McpServer, client: GoogleCustomSearchClient): void {
  server.registerTool(
    "raw_request",
    {
      title: "Raw Custom Search API call",
      // The whole API surface is read-only GETs — there is no write endpoint
      // this escape hatch could reach, so READ_ONLY is the honest worst case.
      annotations: READ_ONLY,
      description:
        "Escape hatch: performs a GET against any Custom Search JSON API path and returns the raw, " +
        "unnormalized response envelope (queries.request/nextPage, searchInformation, promotions, " +
        "context, items[] with htmlSnippet/htmlTitle/formattedUrl and the full pagemap). Use it for " +
        'parameters the typed tools don\'t expose (lowRange/highRange, c2coff, hq, fields) — e.g. path "customsearch/v1?q=test&num=3&fields=items(title,link)". ' +
        "The API key is added automatically (in a header, never the URL) and the configured engine id " +
        "is filled in when the path has no cx parameter. The API has GET endpoints only, so nothing " +
        "here can modify data.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe(
            'API path with query string, relative to https://customsearch.googleapis.com — e.g. "customsearch/v1?q=hello&num=3".',
          ),
      },
    },
    async ({ path }) => {
      try {
        return ok(await client.request(path));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
