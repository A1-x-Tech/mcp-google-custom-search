import type {
  GoogleCustomSearchConfig,
  ImageColorType,
  ImageDominantColor,
  ImageSize,
  ImageType,
  SafeSearch,
  SiteSearchFilter,
} from "./types.js";
import { GoogleCustomSearchError } from "./types.js";
import { CredentialsError, EngineIdError } from "./config.js";

/**
 * The Custom Search JSON API is read-only: its whole surface is one GET
 * endpoint (customsearch/v1). There are no writes, so every request is
 * idempotent and safe to retry after an ambiguous failure.
 */
export type HttpMethod = "GET";

/** Normalized inputs shared by web and image search. */
export interface SearchParams {
  query: string;
  /** Overrides the configured GOOGLE_CUSTOM_SEARCH_ENGINE_ID for this call. */
  engineId?: string;
  /** Results per page, 1..10 (the API's hard maximum per request). */
  num?: number;
  /** 1-based index of the first result; the API serves at most 100 results per query. */
  start?: number;
  safe?: SafeSearch;
  /** Result language, e.g. "en" or "zh-CN" — mapped to lr=lang_<code>. */
  language?: string;
  /** Geolocation bias, a 2-letter country code, e.g. "de" — mapped to gl. */
  country?: string;
  /** Restrict to documents from a country, e.g. "DE" — mapped to cr=countryDE. */
  countryRestrict?: string;
  /** Interface language for the query interpretation, e.g. "de" — mapped to hl. */
  interfaceLanguage?: string;
  /** A site or domain, e.g. "example.com" — combined with siteSearchFilter. */
  siteSearch?: string;
  /** include = only that site, exclude = everything but it. Mapped to the wire i/e. */
  siteSearchFilter?: SiteSearchFilter;
  /** Recency window: d/w/m/y + count, e.g. "d7" (7 days), "m6", "y1". */
  dateRestrict?: string;
  /** Phrase every result must contain. */
  exactTerms?: string;
  /** Word or phrase no result may contain. */
  excludeTerms?: string;
  /** Results must contain at least one of these words. */
  orTerms?: string;
  /** Restrict to a file type, e.g. "pdf". */
  fileType?: string;
  /** License filter, e.g. "cc_publicdomain" (combinable with |). */
  rights?: string;
  /** Sort expression, e.g. "date". Omitted = relevance. */
  sort?: string;
  /** Google's duplicate-content filter; the API's default is on. */
  filterDuplicates?: boolean;
  /** Attach each item's raw pagemap (structured page metadata; can be large). */
  includePagemap?: boolean;
}

/** Image search: everything above plus the image-only filters. */
export interface ImageSearchParams extends SearchParams {
  size?: ImageSize;
  type?: ImageType;
  colorType?: ImageColorType;
  dominantColor?: ImageDominantColor;
}

/** One normalized search result. */
export interface NormalizedItem {
  title?: string;
  url?: string;
  display_link?: string;
  snippet?: string;
  mime?: string;
  file_format?: string;
  image?: {
    context_url?: string;
    width?: number;
    height?: number;
    byte_size?: number;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
  };
  pagemap?: unknown;
}

/** The normalized response shape every search tool returns. */
export interface NormalizedSearchResponse {
  query: string;
  /** Google's estimate — it can shrink while paging; the API serves at most 100 results. */
  total_results: number;
  search_time_seconds?: number;
  /** Google's spelling suggestion; the results are still for the original query. */
  corrected_query?: string;
  /** Pass as `start` to fetch the next/previous page; absent = no such page. */
  next_start?: number;
  previous_start?: number;
  items: NormalizedItem[];
}

/** Maps a normalized image size to the API's uppercase wire enum. */
function mapImageSize(size: ImageSize): string {
  return {
    icon: "ICON",
    small: "SMALL",
    medium: "MEDIUM",
    large: "LARGE",
    xlarge: "XLARGE",
    xxlarge: "XXLARGE",
    huge: "HUGE",
  }[size];
}

/** Maps the normalized site-search mode to the API's one-letter wire enum. */
function mapSiteSearchFilter(filter: SiteSearchFilter): string {
  return { include: "i", exclude: "e" }[filter];
}

/**
 * Builds the query-string parameters for a web search from the normalized
 * vocabulary. Pure wire mapping (lr=lang_<code>, cr=country<CC>, the i/e
 * site-search filter, the 0/1 duplicate filter) — no key, no cx: auth and
 * engine addressing are the client's job.
 */
export function buildSearchQuery(p: SearchParams): Record<string, string> {
  return compact({
    q: p.query,
    num: p.num !== undefined ? String(p.num) : undefined,
    start: p.start !== undefined ? String(p.start) : undefined,
    safe: p.safe,
    lr: p.language ? `lang_${p.language}` : undefined,
    gl: p.country?.toLowerCase(),
    cr: p.countryRestrict ? `country${p.countryRestrict.toUpperCase()}` : undefined,
    hl: p.interfaceLanguage,
    siteSearch: p.siteSearch,
    siteSearchFilter: p.siteSearchFilter ? mapSiteSearchFilter(p.siteSearchFilter) : undefined,
    dateRestrict: p.dateRestrict,
    exactTerms: p.exactTerms,
    excludeTerms: p.excludeTerms,
    orTerms: p.orTerms,
    fileType: p.fileType,
    rights: p.rights,
    sort: p.sort,
    filter: p.filterDuplicates === undefined ? undefined : p.filterDuplicates ? "1" : "0",
  });
}

/** The web-search query plus searchType=image and the image-only filters. */
export function buildImageSearchQuery(p: ImageSearchParams): Record<string, string> {
  return compact({
    ...buildSearchQuery(p),
    searchType: "image",
    imgSize: p.size ? mapImageSize(p.size) : undefined,
    imgType: p.type,
    imgColorType: p.colorType,
    imgDominantColor: p.dominantColor,
  });
}

/**
 * Reduces the API's response envelope to the structured shape the tools
 * return: title/url/snippet plus metadata per item, the totals, the spelling
 * suggestion and ready-to-use next_start/previous_start page cursors.
 * pagemap (arbitrary structured page data, often large) rides along only when
 * asked for.
 */
export function normalizeSearchResponse(raw: unknown, includePagemap = false): NormalizedSearchResponse {
  const data = (raw ?? {}) as Record<string, any>;
  const request = data.queries?.request?.[0] ?? {};
  const nextPage = data.queries?.nextPage?.[0];
  const previousPage = data.queries?.previousPage?.[0];
  const info = data.searchInformation ?? {};

  const totalResults = Number(info.totalResults ?? request.totalResults);
  const searchTime = Number(info.searchTime);

  const items: NormalizedItem[] = Array.isArray(data.items)
    ? data.items.map((item: Record<string, any>) =>
        compactItem({
          title: item.title,
          url: item.link,
          display_link: item.displayLink,
          snippet: item.snippet,
          mime: item.mime,
          file_format: item.fileFormat,
          image: item.image
            ? compactItem({
                context_url: item.image.contextLink,
                width: item.image.width,
                height: item.image.height,
                byte_size: item.image.byteSize,
                thumbnail_url: item.image.thumbnailLink,
                thumbnail_width: item.image.thumbnailWidth,
                thumbnail_height: item.image.thumbnailHeight,
              })
            : undefined,
          pagemap: includePagemap ? item.pagemap : undefined,
        }),
      )
    : [];

  return compactItem({
    query: typeof request.searchTerms === "string" ? request.searchTerms : "",
    total_results: Number.isFinite(totalResults) ? totalResults : 0,
    search_time_seconds: Number.isFinite(searchTime) ? searchTime : undefined,
    corrected_query: data.spelling?.correctedQuery,
    next_start: typeof nextPage?.startIndex === "number" ? nextPage.startIndex : undefined,
    previous_start: typeof previousPage?.startIndex === "number" ? previousPage.startIndex : undefined,
    items,
  }) as NormalizedSearchResponse;
}

export class GoogleCustomSearchClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(private readonly config: GoogleCustomSearchConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  /**
   * Returns the API key or throws {@link CredentialsError} BEFORE any fetch —
   * a missing setup must never enter the retry/backoff loop, because no amount
   * of retrying mints credentials. The Custom Search JSON API authenticates
   * with a static key (no OAuth, no scopes, no refresh), so unlike the OAuth
   * servers of this line there is no token lifecycle here: a 401/403 is
   * terminal and surfaces as a GoogleCustomSearchError.
   */
  private apiKey(): string {
    if (!this.config.apiKey) throw new CredentialsError();
    return this.config.apiKey;
  }

  /**
   * The engine id for a call: the per-call override wins, else the configured
   * default. Thrown before any fetch — without a cx the API would only answer
   * with a less helpful 400.
   */
  private resolveEngineId(override?: string): string {
    const engineId = override || this.config.engineId;
    if (!engineId) throw new EngineIdError();
    return engineId;
  }

  /**
   * Backoff before a retry: honors Retry-After (either RFC 9110 form) when
   * present, else exponential — capped at 30s either way.
   */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = retryAfterMs(res?.headers.get("Retry-After"));
    if (retryAfter !== undefined) return Math.min(retryAfter, 30_000);
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   * `label` is a path without query parameters — it ends up in error messages.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level GET to a Custom Search API path (e.g. "customsearch/v1"). The
   * API key is sent in the X-Goog-Api-Key header — never in the URL, so it
   * cannot leak through logged or echoed URLs. When the resolved URL carries
   * no `cx` and a default engine id is configured, it is filled in (raw_request
   * callers cannot know the configured cx). 429 and — because the whole API is
   * idempotent GETs — 5xx/network errors are retried with backoff; any other
   * non-2xx throws a {@link GoogleCustomSearchError}.
   */
  async request<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the API key can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), this.base);
    if (url.origin !== new URL(this.base).origin) {
      throw new Error(`raw_request path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    if (!url.searchParams.has("cx") && this.config.engineId) {
      url.searchParams.set("cx", this.config.engineId);
    }

    // Credentials are checked before the first network round-trip and outside
    // the retry loop: CredentialsError must never burn backoff time.
    const headers: Record<string, string> = { "X-Goog-Api-Key": this.apiKey() };
    const target = url.toString();

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(target, { method: "GET", headers }, url.pathname));
      } catch (err) {
        // Network error or timeout. Every Custom Search request is an
        // idempotent GET (the API has no writes), so a replay is always safe.
        if (attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // 429 (rejected before executing) and 5xx are both retried: with a
      // read-only API there is no write that an ambiguous failure could
      // duplicate. A non-transient status (400 bad parameter, 403 key/quota
      // problem) fails fast — retrying cannot fix it.
      const transient = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleCustomSearchError(res.status, data);
      return data as T;
    }
  }

  // ---- Search ----

  /** Web search through the Programmable Search Engine, normalized. */
  async search(p: SearchParams): Promise<NormalizedSearchResponse> {
    // Credentials outrank addressing: a fully unconfigured install must read
    // the CredentialsError (naming both variables), not the engine-id error.
    this.apiKey();
    const raw = await this.request("customsearch/v1", {
      cx: this.resolveEngineId(p.engineId),
      ...buildSearchQuery(p),
    });
    return normalizeSearchResponse(raw, p.includePagemap);
  }

  /** Image search (searchType=image); the engine must have image search enabled. */
  async searchImages(p: ImageSearchParams): Promise<NormalizedSearchResponse> {
    this.apiKey(); // same ordering as search(): credentials before addressing
    const raw = await this.request("customsearch/v1", {
      cx: this.resolveEngineId(p.engineId),
      ...buildImageSearchQuery(p),
    });
    return normalizeSearchResponse(raw, p.includePagemap);
  }
}

/**
 * Parses a Retry-After header into a wait in milliseconds. RFC 9110 allows two
 * forms — delta-seconds ("120") and an HTTP-date ("Fri, 01 Jan 2027 12:00:00
 * GMT") — and both must be honored. Returns undefined for an absent or
 * unparseable value, or one that is not in the future; the caller then falls
 * back to exponential backoff. The numeric form is tried first: Date.parse
 * would misread a bare number as a year.
 */
export function retryAfterMs(header: string | null | undefined, now: number = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds > 0 ? seconds * 1000 : undefined;
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs) && dateMs > now) return dateMs - now;
  return undefined;
}

/** Drops entries whose value is `undefined` so they are not sent to the API. */
function compact(obj: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<string, string>;
}

/** compact() for arbitrary values (normalized response assembly). */
function compactItem<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
