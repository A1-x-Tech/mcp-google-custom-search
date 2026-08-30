import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCustomSearchClient, SearchParams } from "../client.js";
import {
  checkPageWindow,
  countryCodeSchema,
  dateRestrictSchema,
  engineIdSchema,
  fail,
  languageCodeSchema,
  numSchema,
  ok,
  querySchema,
  READ_ONLY,
  startSchema,
} from "./util.js";

/**
 * The input fields shared by web and image search. A factory, like every
 * schema in util.ts: each call returns fresh zod objects so no two fields
 * ever share one schema instance ($ref dedup).
 */
export function searchInputFields() {
  return {
    query: querySchema(),
    engine_id: engineIdSchema(),
    num: numSchema(),
    start: startSchema(),
    safe: z
      .enum(["off", "active"])
      .optional()
      .describe("Safe search: active filters adult content, off (the API default) does not."),
    language: languageCodeSchema()
      .optional()
      .describe('Only results in this language, e.g. "en", "de", "zh-CN".'),
    country: countryCodeSchema()
      .optional()
      .describe('Geolocation bias — rank results as if searching from this country, e.g. "de". Soft signal.'),
    country_restrict: countryCodeSchema()
      .optional()
      .describe('Hard filter — only documents Google attributes to this country, e.g. "DE".'),
    interface_language: languageCodeSchema()
      .optional()
      .describe('Interface language used to interpret the query, e.g. "de". Improves non-English relevance.'),
    site_search: z
      .string()
      .min(1)
      .optional()
      .describe('A site or domain to include or exclude, e.g. "example.com" — pair with site_search_filter.'),
    site_search_filter: z
      .enum(["include", "exclude"])
      .optional()
      .describe("include = only results from site_search, exclude = everything but it. Default include."),
    date_restrict: dateRestrictSchema(),
    exact_terms: z.string().min(1).optional().describe("A phrase every result must contain."),
    exclude_terms: z.string().min(1).optional().describe("A word or phrase no result may contain."),
    or_terms: z
      .string()
      .min(1)
      .optional()
      .describe("Space-separated words — each result must contain at least one of them."),
    file_type: z
      .string()
      .regex(/^[a-zA-Z0-9]{1,10}$/, 'Must be a bare extension like "pdf"')
      .optional()
      .describe('Only files of this type, e.g. "pdf", "xlsx", "svg".'),
    rights: z
      .string()
      .min(1)
      .optional()
      .describe(
        "License filter: cc_publicdomain, cc_attribute, cc_sharealike, cc_noncommercial, cc_nonderived " +
          "(combine with |).",
      ),
    sort: z
      .string()
      .min(1)
      .optional()
      .describe('Sort expression, e.g. "date" for newest-first. Omit for relevance (usually better).'),
    filter_duplicates: z
      .boolean()
      .optional()
      .describe("Google's duplicate-content filter (default on). false returns near-duplicate results too."),
    include_pagemap: z
      .boolean()
      .optional()
      .describe(
        "Attach each result's raw pagemap (OpenGraph/metatags/thumbnails and other structured page data). " +
          "Verbose — leave off unless you need page metadata.",
      ),
  };
}

/** Maps the snake_case tool arguments onto the client's normalized SearchParams. */
export function toSearchParams(args: {
  query: string;
  engine_id?: string;
  num?: number;
  start?: number;
  safe?: "off" | "active";
  language?: string;
  country?: string;
  country_restrict?: string;
  interface_language?: string;
  site_search?: string;
  site_search_filter?: "include" | "exclude";
  date_restrict?: string;
  exact_terms?: string;
  exclude_terms?: string;
  or_terms?: string;
  file_type?: string;
  rights?: string;
  sort?: string;
  filter_duplicates?: boolean;
  include_pagemap?: boolean;
}): SearchParams {
  return {
    query: args.query,
    engineId: args.engine_id,
    num: args.num,
    start: args.start,
    safe: args.safe,
    language: args.language,
    country: args.country,
    countryRestrict: args.country_restrict,
    interfaceLanguage: args.interface_language,
    siteSearch: args.site_search,
    siteSearchFilter: args.site_search_filter,
    dateRestrict: args.date_restrict,
    exactTerms: args.exact_terms,
    excludeTerms: args.exclude_terms,
    orTerms: args.or_terms,
    fileType: args.file_type,
    rights: args.rights,
    sort: args.sort,
    filterDuplicates: args.filter_duplicates,
    includePagemap: args.include_pagemap,
  };
}

export function registerSearchTools(server: McpServer, client: GoogleCustomSearchClient): void {
  server.registerTool(
    "search",
    {
      title: "Web search",
      annotations: READ_ONLY,
      description:
        "Web search through your Google Programmable Search Engine (Custom Search JSON API). Returns " +
        "query, total_results (Google's estimate — it can shrink while paging), search_time_seconds, " +
        "corrected_query (spelling suggestion; results are still for the original query), " +
        "next_start/previous_start page cursors, and items[] with title, url, display_link, snippet, " +
        "mime/file_format and (with include_pagemap) pagemap metadata. Coverage is the engine's " +
        "configuration: an engine listing specific sites searches only those; open-web search needs " +
        '"Search the entire web" enabled in its control panel — results still differ from google.com. ' +
        "Max 10 results per call and 100 per query: paginate by passing next_start as start. Each call " +
        "costs one unit of the daily quota (free tier 100/day), so prefer one precise query over many " +
        "broad ones. Note: this is Programmable Search, NOT Google Search Console — it cannot report " +
        "how your own site is indexed or ranked.",
      inputSchema: searchInputFields(),
    },
    async (args) => {
      try {
        checkPageWindow(args.start, args.num);
        return ok(await client.search(toSearchParams(args)));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
