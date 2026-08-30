import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSearchTools, toSearchParams } from "./search.js";

type Args = Record<string, unknown>;
type Handler = (args: Args) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function harness(opts: { throwOn?: string } = {}) {
  const calls: { method: string; params: unknown[] }[] = [];
  const make =
    (method: string) =>
    async (...params: unknown[]) => {
      calls.push({ method, params });
      if (opts.throwOn === method) throw new Error("boom");
      return { query: "q", total_results: 0, items: [] };
    };
  const client = { search: make("search") };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerSearchTools(server as never, client as never);
  return { calls, tools };
}

test("registers the search tool", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["search"]);
});

test("search forwards every argument as normalized client params", async () => {
  const { calls, tools } = harness();
  await tools.search({
    query: "mcp",
    engine_id: "cx-1",
    num: 5,
    start: 11,
    safe: "active",
    language: "de",
    country: "de",
    country_restrict: "DE",
    interface_language: "de",
    site_search: "example.com",
    site_search_filter: "exclude",
    date_restrict: "m6",
    exact_terms: "phrase",
    exclude_terms: "jobs",
    or_terms: "sdk api",
    file_type: "pdf",
    rights: "cc_publicdomain",
    sort: "date",
    filter_duplicates: false,
    include_pagemap: true,
  });
  assert.equal(calls[0].method, "search");
  assert.deepEqual(calls[0].params[0], {
    query: "mcp",
    engineId: "cx-1",
    num: 5,
    start: 11,
    safe: "active",
    language: "de",
    country: "de",
    countryRestrict: "DE",
    interfaceLanguage: "de",
    siteSearch: "example.com",
    siteSearchFilter: "exclude",
    dateRestrict: "m6",
    exactTerms: "phrase",
    excludeTerms: "jobs",
    orTerms: "sdk api",
    fileType: "pdf",
    rights: "cc_publicdomain",
    sort: "date",
    filterDuplicates: false,
    includePagemap: true,
  });
});

test("a minimal call forwards just the query", async () => {
  const { calls, tools } = harness();
  await tools.search({ query: "hello" });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.query, "hello");
  for (const [key, value] of Object.entries(params)) {
    if (key !== "query") assert.equal(value, undefined, `${key} must stay undefined`);
  }
});

test("toSearchParams is a pure field-for-field rename", () => {
  assert.deepEqual(toSearchParams({ query: "q", site_search_filter: "include" }).siteSearchFilter, "include");
  assert.equal(toSearchParams({ query: "q" }).engineId, undefined);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "search" });
  const res = await tools.search({ query: "q" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});

test("a paging window past result 100 is rejected before the client is called", async () => {
  const { calls, tools } = harness();
  const res = await tools.search({ query: "q", start: 100, num: 10 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /start \+ num - 1 must stay <= 100/);
  assert.equal(calls.length, 0, "the API would answer 400 after burning a quota unit — never call it");
});
