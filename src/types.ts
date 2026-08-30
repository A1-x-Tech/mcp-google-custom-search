/**
 * The server talks to the Google Custom Search JSON API
 * (https://customsearch.googleapis.com, REST over JSON). Auth is an API key
 * sent in the X-Goog-Api-Key header — the Custom Search JSON API does not use
 * OAuth, so there are no scopes to grant and no tokens to refresh. Every
 * request also needs a Programmable Search Engine id (`cx`), configured once
 * via the environment or passed per call.
 */

/** Safe-search mode, passed through to the API (`safe` accepts exactly these two). */
export type SafeSearch = "off" | "active";

/**
 * Normalized image size; the client maps it to the API's uppercase wire enum
 * (ICON / SMALL / ... / HUGE).
 */
export type ImageSize = "icon" | "small" | "medium" | "large" | "xlarge" | "xxlarge" | "huge";

/** Image type filter (API wire values are the same lowercase words, passed through). */
export type ImageType = "clipart" | "face" | "lineart" | "stock" | "photo" | "animated";

/** Image color type filter (API wire values, passed through). */
export type ImageColorType = "mono" | "gray" | "color" | "trans";

/** Dominant color filter (API wire values, passed through). */
export type ImageDominantColor =
  | "black"
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal"
  | "white"
  | "yellow";

/**
 * Normalized site-search mode; the client maps it to the API's one-letter wire
 * enum (`i` / `e`).
 */
export type SiteSearchFilter = "include" | "exclude";

export interface GoogleCustomSearchConfig {
  /** Google Cloud API key with the Custom Search API enabled. Treated as a secret. */
  apiKey?: string;
  /** Default Programmable Search Engine id (`cx`). Tools can override it per call. */
  engineId?: string;
  /** API root. Defaults to https://customsearch.googleapis.com. */
  apiBase: string;
  /** Per-request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number;
  /** Max retries for transient errors (429 and, for these idempotent GETs, 5xx/network). Defaults to 3. */
  maxRetries?: number;
  /** Base backoff in milliseconds, doubled each retry. Defaults to 500. */
  retryBaseMs?: number;
}

/**
 * Google APIs report failures as a non-2xx HTTP status with a JSON envelope
 * ({ error: { code, message, status, details } }). The parsed body is kept
 * alongside the status and a short readable message is derived. The API key
 * travels in a header, never in the URL or the body, so neither the message
 * nor `body` can contain it.
 */
export class GoogleCustomSearchError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}: ${formatErrorBody(body)}`);
    this.name = "GoogleCustomSearchError";
    this.status = status;
    this.body = body;
  }
}

/** Turns a parsed Google API error body into a short, readable message. */
function formatErrorBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body !== "object") return String(body);
  const obj = body as Record<string, unknown>;

  // Flat style: { error: "rateLimitExceeded", error_description: "..." }
  if (typeof obj.error === "string") {
    const description = typeof obj.error_description === "string" ? `: ${obj.error_description}` : "";
    return `${obj.error}${description}`.slice(0, 500);
  }

  // Google API envelope: { error: { code, message, status, details } }
  const err = (typeof obj.error === "object" && obj.error !== null ? obj.error : obj) as Record<string, unknown>;
  if (typeof err.message === "string") {
    const status = typeof err.status === "string" ? `[${err.status}] ` : "";
    return `${status}${err.message}`.slice(0, 500);
  }

  return JSON.stringify(obj).slice(0, 500);
}
