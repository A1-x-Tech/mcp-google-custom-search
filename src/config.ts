import type { GoogleCustomSearchConfig } from "./types.js";

/** Default Google Custom Search API host. */
export const DEFAULT_BASE = "https://customsearch.googleapis.com";

/**
 * A malformed environment variable. Thrown instead of exiting on the spot so
 * index.ts can catch it, report the drop-off and start degraded instead of
 * dying; `reason` is the machine-readable code that ships with that ping
 * (never a variable's value).
 */
export class ConfigError extends Error {
  readonly reason: string;

  constructor(message: string, reason: string) {
    super(message);
    this.name = "ConfigError";
    this.reason = reason;
  }
}

/**
 * What a tool call without credentials reads. The first sentence is the
 * would-be startup error; the rest exists because credentials come only from
 * the environment, so the fix is an operator action plus a restart, never a
 * retry.
 */
export const MISSING_CREDENTIALS_MESSAGE =
  "A Google API key is required: set GOOGLE_CUSTOM_SEARCH_API_KEY (an API key from a Google " +
  "Cloud project with the Custom Search API enabled) and GOOGLE_CUSTOM_SEARCH_ENGINE_ID " +
  "(the Programmable Search Engine cx id from programmablesearchengine.google.com). " +
  "This is not a network failure and retrying will not help: the operator must set these " +
  "environment variables in the MCP client's server config and restart the server — they are " +
  "read only at startup.";

/**
 * Raised when a tool call needs credentials and none were configured. The
 * message is the whole point of the class: it is the only text the calling
 * model reads about the missing setup, so it names the fix (which variables,
 * and that a restart is needed) instead of the failure.
 */
export class CredentialsError extends Error {
  constructor(message: string = MISSING_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "CredentialsError";
  }
}

/**
 * What a search without an engine id reads. Unlike the missing key this is
 * addressing, not a credential, so the fix can also be per call: pass
 * engine_id instead of restarting.
 */
export const MISSING_ENGINE_ID_MESSAGE =
  "No search engine id: set GOOGLE_CUSTOM_SEARCH_ENGINE_ID (and restart) or pass engine_id — " +
  "the cx id of a Programmable Search Engine from programmablesearchengine.google.com.";

/**
 * Raised when a search needs an engine id (cx) and neither the per-call
 * engine_id override nor GOOGLE_CUSTOM_SEARCH_ENGINE_ID provides one. Typed —
 * like {@link CredentialsError} — so callers can tell "missing addressing"
 * apart from credential and transport failures programmatically.
 */
export class EngineIdError extends Error {
  constructor(message: string = MISSING_ENGINE_ID_MESSAGE) {
    super(message);
    this.name = "EngineIdError";
  }
}

/**
 * True when the config carries a usable API key. The engine id is deliberately
 * not part of this check: it is addressing, not a credential, and every search
 * tool accepts a per-call engine_id override — a key-only install is degraded
 * but usable, a keyless one is not usable at all.
 */
export function hasCredentials(config: GoogleCustomSearchConfig): boolean {
  return Boolean(config.apiKey);
}

/**
 * Builds the client config from environment variables.
 *
 * Missing credentials are NOT an error here: the server starts anyway and the
 * client raises {@link CredentialsError} on the first tool call, so an
 * unconfigured install completes the MCP handshake and carries the fix into
 * the session instead of dying before it with nothing to read. A malformed
 * setup — an engine id with no API key — still throws, because the operator
 * clearly attempted a configuration and guessing what they meant is worse
 * (the key cannot be supplied per call, so that install can never work).
 *
 *   GOOGLE_CUSTOM_SEARCH_API_KEY     Google Cloud API key (Custom Search API enabled)
 *   GOOGLE_CUSTOM_SEARCH_ENGINE_ID   default Programmable Search Engine id (cx)
 *   GOOGLE_CUSTOM_SEARCH_API_BASE    API root override (default https://customsearch.googleapis.com)
 *   GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS  per-request timeout (default 30000)
 *   GOOGLE_CUSTOM_SEARCH_MAX_RETRIES retries on transient errors (default 3)
 */
export function loadConfig(): GoogleCustomSearchConfig {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (engineId && !apiKey) {
    throw new ConfigError(
      "GOOGLE_CUSTOM_SEARCH_ENGINE_ID is set but GOOGLE_CUSTOM_SEARCH_API_KEY is missing — the API key " +
        "cannot be supplied per call, so both must be set together.",
      "incomplete_config",
    );
  }

  const timeoutMs = Number(process.env.GOOGLE_CUSTOM_SEARCH_TIMEOUT_MS);
  const maxRetries = Number(process.env.GOOGLE_CUSTOM_SEARCH_MAX_RETRIES);

  return {
    apiKey,
    engineId,
    apiBase: process.env.GOOGLE_CUSTOM_SEARCH_API_BASE || DEFAULT_BASE,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000,
    maxRetries: Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 3,
  };
}
