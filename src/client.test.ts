import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildImageSearchQuery,
  buildSearchQuery,
  GoogleCustomSearchClient,
  normalizeSearchResponse,
  retryAfterMs,
} from "./client.js";
import { CredentialsError, EngineIdError, MISSING_CREDENTIALS_MESSAGE } from "./config.js";
import type { GoogleCustomSearchConfig } from "./types.js";

const BASE = "https://customsearch.googleapis.com";

type Call = { url: string; method: string; key: unknown };

/** A fully configured client (API key + default engine id). */
function configured(extra: Partial<GoogleCustomSearchConfig> = {}): GoogleCustomSearchConfig {
  return { apiKey: "SECRET-KEY", engineId: "cx-default", apiBase: BASE, maxRetries: 0, retryBaseMs: 0, ...extra };
}

/** Installs a recording fetch stub; the handler decides each response. */
function mockFetch(handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const i = (init ?? {}) as RequestInit & { headers?: Record<string, string> };
    calls.push({ url: String(url), method: String(i.method), key: i.headers?.["X-Goog-Api-Key"] });
    return handler(String(url), i, calls.length);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** A realistic (abridged) API envelope for the normalization tests. */
const ENVELOPE = {
  kind: "customsearch#search",
  queries: {
    request: [{ searchTerms: "mcp servers", totalResults: "128000", startIndex: 11, count: 10 }],
    nextPage: [{ startIndex: 21 }],
    previousPage: [{ startIndex: 1 }],
  },
  searchInformation: { searchTime: 0.31, totalResults: "128000" },
  spelling: { correctedQuery: "mcp server" },
  items: [
    {
      title: "Model Context Protocol",
      link: "https://modelcontextprotocol.io/",
      displayLink: "modelcontextprotocol.io",
      snippet: "An open protocol...",
      mime: "text/html",
      fileFormat: "HTML",
      pagemap: { metatags: [{ "og:title": "MCP" }] },
    },
    {
      title: "Some image",
      link: "https://cdn.example.com/pic.png",
      displayLink: "example.com",
      snippet: "A picture",
      image: {
        contextLink: "https://example.com/page",
        width: 800,
        height: 600,
        byteSize: 12345,
        thumbnailLink: "https://enc.example.com/thumb",
        thumbnailWidth: 120,
        thumbnailHeight: 90,
      },
    },
  ],
};

// ---- Auth ----

/**
 * The degraded-start contract: a server without credentials still runs, so the
 * client must fail the call itself — with the exact actionable message, before
 * any fetch. Zero fetch calls proves the error skips the retry/backoff loop
 * entirely (maxRetries is deliberately non-zero here).
 */
test("no credentials: CredentialsError with the exact text, fetch never called", async () => {
  const mock = mockFetch(() => okJson({}));
  try {
    const client = new GoogleCustomSearchClient({ apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => client.search({ query: "hello" }),
      (err: unknown) => {
        assert.ok(err instanceof CredentialsError, "must be a CredentialsError");
        assert.equal(err.message, MISSING_CREDENTIALS_MESSAGE);
        assert.match(err.message, /GOOGLE_CUSTOM_SEARCH_API_KEY/);
        assert.match(err.message, /GOOGLE_CUSTOM_SEARCH_ENGINE_ID/);
        assert.match(err.message, /restart the server/, "the fix must mention the restart");
        return true;
      },
    );
    assert.equal(mock.calls.length, 0, "must not fetch at all — no retries, no backoff");
  } finally {
    mock.restore();
  }
});

test("the API key travels in the X-Goog-Api-Key header and never in the URL", async () => {
  const mock = mockFetch(() => okJson(ENVELOPE));
  try {
    await new GoogleCustomSearchClient(configured()).search({ query: "hello" });
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].key, "SECRET-KEY");
    assert.equal(mock.calls[0].method, "GET");
    assert.ok(!mock.calls[0].url.includes("SECRET-KEY"), "the key must never appear in the URL");
  } finally {
    mock.restore();
  }
});

test("engine id: per-call override wins, config default fills in, neither = clear error before fetch", async () => {
  const mock = mockFetch(() => okJson(ENVELOPE));
  try {
    const client = new GoogleCustomSearchClient(configured());
    await client.search({ query: "q" });
    assert.equal(new URL(mock.calls[0].url).searchParams.get("cx"), "cx-default");

    await client.search({ query: "q", engineId: "cx-override" });
    assert.equal(new URL(mock.calls[1].url).searchParams.get("cx"), "cx-override");
  } finally {
    mock.restore();
  }

  const mock2 = mockFetch(() => okJson(ENVELOPE));
  try {
    const keyOnly = new GoogleCustomSearchClient({ apiKey: "K", apiBase: BASE, maxRetries: 3, retryBaseMs: 0 });
    await assert.rejects(
      () => keyOnly.search({ query: "q" }),
      (err: unknown) => {
        // Typed like every other failure category (CredentialsError,
        // GoogleCustomSearchError): callers must be able to tell "missing
        // addressing" apart programmatically, not by parsing the message.
        assert.ok(err instanceof EngineIdError, "must be an EngineIdError");
        assert.match(err.message, /GOOGLE_CUSTOM_SEARCH_ENGINE_ID.*engine_id/);
        return true;
      },
    );
    assert.equal(mock2.calls.length, 0, "a missing engine id must fail before any fetch");
  } finally {
    mock2.restore();
  }
});

test("request() fills in the configured cx for raw paths but never overrides an explicit one", async () => {
  const mock = mockFetch(() => okJson({}));
  try {
    const client = new GoogleCustomSearchClient(configured());
    await client.request("customsearch/v1?q=test");
    assert.equal(new URL(mock.calls[0].url).searchParams.get("cx"), "cx-default");

    await client.request("customsearch/v1?q=test&cx=cx-explicit");
    assert.equal(new URL(mock.calls[1].url).searchParams.get("cx"), "cx-explicit");
  } finally {
    mock.restore();
  }
});

// ---- Wire mapping ----

test("buildSearchQuery maps the normalized vocabulary to the wire parameters", () => {
  assert.deepEqual(
    buildSearchQuery({
      query: "mcp",
      num: 5,
      start: 11,
      safe: "active",
      language: "de",
      country: "DE",
      countryRestrict: "de",
      interfaceLanguage: "de",
      siteSearch: "example.com",
      siteSearchFilter: "exclude",
      dateRestrict: "m6",
      exactTerms: "model context protocol",
      excludeTerms: "jobs",
      orTerms: "sdk api",
      fileType: "pdf",
      rights: "cc_publicdomain",
      sort: "date",
      filterDuplicates: false,
    }),
    {
      q: "mcp",
      num: "5",
      start: "11",
      safe: "active",
      lr: "lang_de",
      gl: "de",
      cr: "countryDE",
      hl: "de",
      siteSearch: "example.com",
      siteSearchFilter: "e",
      dateRestrict: "m6",
      exactTerms: "model context protocol",
      excludeTerms: "jobs",
      orTerms: "sdk api",
      fileType: "pdf",
      rights: "cc_publicdomain",
      sort: "date",
      filter: "0",
    },
  );
});

test("buildSearchQuery omits everything not provided and maps include/true", () => {
  assert.deepEqual(buildSearchQuery({ query: "q" }), { q: "q" });
  const withFlags = buildSearchQuery({ query: "q", siteSearchFilter: "include", filterDuplicates: true });
  assert.equal(withFlags.siteSearchFilter, "i");
  assert.equal(withFlags.filter, "1");
});

test("buildImageSearchQuery adds searchType=image and maps the image filters", () => {
  assert.deepEqual(
    buildImageSearchQuery({
      query: "sunset",
      size: "xlarge",
      type: "photo",
      colorType: "color",
      dominantColor: "orange",
    }),
    {
      q: "sunset",
      searchType: "image",
      imgSize: "XLARGE",
      imgType: "photo",
      imgColorType: "color",
      imgDominantColor: "orange",
    },
  );
});

// ---- Response normalization ----

test("normalizeSearchResponse builds the structured shape with page cursors", () => {
  const result = normalizeSearchResponse(ENVELOPE);
  assert.equal(result.query, "mcp servers");
  assert.equal(result.total_results, 128000);
  assert.equal(result.search_time_seconds, 0.31);
  assert.equal(result.corrected_query, "mcp server");
  assert.equal(result.next_start, 21);
  assert.equal(result.previous_start, 1);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items[0], {
    title: "Model Context Protocol",
    url: "https://modelcontextprotocol.io/",
    display_link: "modelcontextprotocol.io",
    snippet: "An open protocol...",
    mime: "text/html",
    file_format: "HTML",
  });
  assert.deepEqual(result.items[1].image, {
    context_url: "https://example.com/page",
    width: 800,
    height: 600,
    byte_size: 12345,
    thumbnail_url: "https://enc.example.com/thumb",
    thumbnail_width: 120,
    thumbnail_height: 90,
  });
  assert.equal("pagemap" in result.items[0], false, "pagemap must be dropped unless asked for");
});

test("normalizeSearchResponse keeps pagemap only when includePagemap is set", () => {
  const result = normalizeSearchResponse(ENVELOPE, true);
  assert.deepEqual(result.items[0].pagemap, { metatags: [{ "og:title": "MCP" }] });
});

test("normalizeSearchResponse survives an empty envelope (no items, no next page)", () => {
  const result = normalizeSearchResponse({
    queries: { request: [{ searchTerms: "nothing", totalResults: "0" }] },
    searchInformation: { totalResults: "0", searchTime: 0.1 },
  });
  assert.equal(result.total_results, 0);
  assert.deepEqual(result.items, []);
  assert.equal(result.next_start, undefined);
  assert.equal(result.corrected_query, undefined);
});

// ---- End-to-end mapping through fetch ----

test("search() sends the wire query and returns the normalized result", async () => {
  const mock = mockFetch(() => okJson(ENVELOPE));
  try {
    const result = await new GoogleCustomSearchClient(configured()).search({
      query: "mcp servers",
      num: 10,
      start: 11,
      safe: "active",
      language: "en",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.origin + url.pathname, `${BASE}/customsearch/v1`);
    assert.equal(url.searchParams.get("q"), "mcp servers");
    assert.equal(url.searchParams.get("cx"), "cx-default");
    assert.equal(url.searchParams.get("num"), "10");
    assert.equal(url.searchParams.get("start"), "11");
    assert.equal(url.searchParams.get("safe"), "active");
    assert.equal(url.searchParams.get("lr"), "lang_en");
    assert.equal(url.searchParams.get("searchType"), null, "web search must not send searchType");
    assert.equal(result.query, "mcp servers");
    assert.equal(result.items.length, 2);
  } finally {
    mock.restore();
  }
});

test("searchImages() sends searchType=image plus the image filters", async () => {
  const mock = mockFetch(() => okJson(ENVELOPE));
  try {
    await new GoogleCustomSearchClient(configured()).searchImages({
      query: "sunset",
      size: "large",
      colorType: "trans",
    });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.searchParams.get("searchType"), "image");
    assert.equal(url.searchParams.get("imgSize"), "LARGE");
    assert.equal(url.searchParams.get("imgColorType"), "trans");
  } finally {
    mock.restore();
  }
});

// ---- Retry / timeout / SSRF behavior ----

test("request() retries 429 and 5xx with backoff — the whole API is idempotent GETs", async () => {
  for (const status of [429, 503]) {
    let n = 0;
    const mock = mockFetch(() => {
      n++;
      if (n === 1) return new Response("transient", { status });
      return okJson({ ok: true });
    });
    try {
      const result = await new GoogleCustomSearchClient(configured({ maxRetries: 3 })).request("customsearch/v1?q=x");
      assert.deepEqual(result, { ok: true });
      assert.equal(n, 2, `a ${status} must be retried`);
    } finally {
      mock.restore();
    }
  }
});

test("retryAfterMs honors both RFC 9110 forms: delta-seconds and HTTP-date", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  // delta-seconds
  assert.equal(retryAfterMs("7", now), 7_000);
  // HTTP-date: the wait is the distance to that moment
  assert.equal(retryAfterMs(new Date(now + 12_000).toUTCString(), now), 12_000);
  // not-in-the-future and unparseable values fall through to exponential backoff
  assert.equal(retryAfterMs("0", now), undefined);
  assert.equal(retryAfterMs(new Date(now - 60_000).toUTCString(), now), undefined);
  assert.equal(retryAfterMs("soon", now), undefined);
  assert.equal(retryAfterMs(null, now), undefined);
  assert.equal(retryAfterMs("", now), undefined);
});

test("a 429 with an HTTP-date Retry-After is honored instead of exponential backoff", async () => {
  let n = 0;
  const retryAt = new Date(Date.now() + 1_000).toUTCString(); // whole-second resolution → ≤1s away
  const mock = mockFetch(() => {
    n++;
    if (n === 1) return new Response("slow down", { status: 429, headers: { "Retry-After": retryAt } });
    return okJson({ ok: true });
  });
  try {
    // retryBaseMs is deliberately huge: only the honored header keeps this fast.
    const started = Date.now();
    const client = new GoogleCustomSearchClient(configured({ maxRetries: 1, retryBaseMs: 3_600_000 }));
    const result = await client.request("customsearch/v1?q=x");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
    assert.ok(Date.now() - started < 5_000, "the HTTP-date must set the wait, not the exponential fallback");
  } finally {
    mock.restore();
  }
});

test("request() retries a network error and eventually succeeds", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    if (n === 1) throw new Error("ECONNRESET");
    return okJson({ ok: true });
  });
  try {
    const result = await new GoogleCustomSearchClient(configured({ maxRetries: 2 })).request("customsearch/v1?q=x");
    assert.deepEqual(result, { ok: true });
    assert.equal(n, 2);
  } finally {
    mock.restore();
  }
});

test("request() does not retry a 400/403 and gives up after maxRetries on 429", async () => {
  let n = 0;
  const mock = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"bad cx","status":"INVALID_ARGUMENT"}}', { status: 400 });
  });
  try {
    await assert.rejects(
      () => new GoogleCustomSearchClient(configured({ maxRetries: 3 })).request("customsearch/v1?q=x"),
      /HTTP 400: \[INVALID_ARGUMENT\] bad cx/,
    );
    assert.equal(n, 1, "a 400 must fail fast");
  } finally {
    mock.restore();
  }

  n = 0;
  const mock2 = mockFetch(() => {
    n++;
    return new Response('{"error":{"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}', { status: 429 });
  });
  try {
    await assert.rejects(
      () => new GoogleCustomSearchClient(configured({ maxRetries: 2 })).request("customsearch/v1?q=x"),
      /HTTP 429: \[RESOURCE_EXHAUSTED\] Quota exceeded/,
    );
    assert.equal(n, 3); // initial + 2 retries
  } finally {
    mock2.restore();
  }
});

test("a 403 surfaces the Google error message — and never the API key", async () => {
  const mock = mockFetch(
    () =>
      new Response(
        '{"error":{"code":403,"message":"Custom Search API has not been used in project 123","status":"PERMISSION_DENIED"}}',
        { status: 403 },
      ),
  );
  try {
    await assert.rejects(
      () => new GoogleCustomSearchClient(configured()).search({ query: "q" }),
      (err: unknown) => {
        assert.match(String(err), /HTTP 403: \[PERMISSION_DENIED\] Custom Search API has not been used/);
        assert.ok(!String(err).includes("SECRET-KEY"), "error messages must never carry the key");
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});

test("request() aborts on timeout; the message carries the path but no query string", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init: unknown) =>
    new Promise((_resolve, reject) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  try {
    const client = new GoogleCustomSearchClient(configured({ timeoutMs: 10, maxRetries: 0 }));
    await client.search({ query: "secret question" }).then(
      () => assert.fail("must reject"),
      (err) => {
        assert.match(String(err), /timed out after 10ms/);
        assert.ok(!String(err).includes("secret question"), "the query must not leak into the timeout message");
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("request() rejects an absolute path (SSRF) and never fetches a foreign origin", async () => {
  for (const evil of ["https://evil.example/steal", "http://evil.example/x", "\\\\evil.example/x"]) {
    const mock = mockFetch(() => okJson({}));
    try {
      await assert.rejects(
        () => new GoogleCustomSearchClient(configured()).request(evil),
        /foreign origin/,
      );
      assert.equal(mock.calls.length, 0, `must not fetch for ${JSON.stringify(evil)}`);
    } finally {
      mock.restore();
    }
  }
});

test("request() still accepts a relative API path with a query string", async () => {
  const mock = mockFetch(() => okJson({ ok: true }));
  try {
    const result = await new GoogleCustomSearchClient(configured()).request("customsearch/v1?q=hello&num=3");
    assert.deepEqual(result, { ok: true });
    const url = new URL(mock.calls[0].url);
    assert.equal(url.searchParams.get("q"), "hello");
    assert.equal(url.searchParams.get("num"), "3");
    assert.equal(url.searchParams.get("cx"), "cx-default");
  } finally {
    mock.restore();
  }
});
