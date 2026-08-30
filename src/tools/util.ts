import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Schema factories, not shared consts: reusing one zod object across two fields
 * makes zod-to-json-schema dedupe them into a `$ref`, which some tool-schema
 * consumers (OpenAI Apps review) don't dereference and flag as `any`. A fresh
 * object per field keeps each one inlined with its type + pattern.
 */
export const querySchema = () =>
  z
    .string()
    .min(1)
    .describe("The search query, Google syntax included (quotes, site:, filetype:, OR, -exclusions).");

export const engineIdSchema = () =>
  z
    .string()
    .min(1)
    .optional()
    .describe(
      "Programmable Search Engine id (cx) to search with, overriding the configured " +
        "GOOGLE_CUSTOM_SEARCH_ENGINE_ID. Omit to use the configured engine.",
    );

/** Results per page. The API's hard maximum is 10 per request. */
export const numSchema = () =>
  z.number().int().min(1).max(10).optional().describe("Results per page, 1..10 (API maximum 10; default 10).");

/**
 * 1-based index of the first result. The API never serves past the first 100
 * results, so start + num - 1 must stay <= 100.
 */
export const startSchema = () =>
  z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "1-based index of the first result — use next_start/previous_start from the previous page. " +
        "The API serves at most 100 results per query, so start + num - 1 must stay <= 100 " +
        "(enforced: a wider window is rejected without spending quota).",
    );

/**
 * The one paging rule the flat zod field schemas cannot express: the API never
 * serves past result 100, so the requested window must end at or before it
 * (start + num - 1 <= 100). Checked in the tool handlers, before the request —
 * the API would answer 400 anyway, but only after burning a unit of the daily
 * quota. An omitted num counts as the API's server-side default of 10.
 */
export function checkPageWindow(start?: number, num?: number): void {
  if (start === undefined) return;
  const effectiveNum = num ?? 10;
  const last = start + effectiveNum - 1;
  if (last > 100) {
    throw new Error(
      `start + num - 1 must stay <= 100 (the API never serves past the first 100 results), but ` +
        `start=${start} with num=${effectiveNum}${num === undefined ? " (the API default)" : ""} asks for ` +
        `results up to ${last}. Lower start or num so the window ends at result 100 or earlier.`,
    );
  }
}

/** ISO language code, e.g. "en" or "zh-CN" — the shape lr/hl accept once mapped. */
export const languageCodeSchema = () =>
  z.string().regex(/^[a-zA-Z]{2}(-[a-zA-Z]{2,4})?$/, 'Must be a language code like "en" or "zh-CN"');

/** 2-letter country code, e.g. "de". */
export const countryCodeSchema = () =>
  z.string().regex(/^[a-zA-Z]{2}$/, 'Must be a 2-letter country code like "de"');

/** The API's dateRestrict format: d/w/m/y + a positive count. */
export const dateRestrictSchema = () =>
  z
    .string()
    .regex(/^[dwmy][1-9]\d*$/, 'Must be d/w/m/y followed by a count, e.g. "d7", "w2", "m6", "y1"')
    .optional()
    .describe('Only results from the last N days/weeks/months/years: "d7", "w2", "m6", "y1", ...');

/** Wraps a value as a compact-JSON tool result (compact: the consumer is an LLM). */
export function ok(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { content: [{ type: "text", text: text ?? "null" }] };
}

export function fail(err: unknown): CallToolResult {
  let message = err instanceof Error ? err.message : String(err);
  // Surface the underlying cause (e.g. the network error behind a timeout) — no
  // secrets live in cause, and it makes failures far easier to diagnose.
  if (err instanceof Error && err.cause instanceof Error) message += ` (${err.cause.message})`;
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * MCP tool annotations — hints the consuming client can use to gate or label a
 * tool. All four hints are set explicitly on every tool: some clients (OpenAI
 * Apps review) require readOnlyHint, destructiveHint and openWorldHint on each.
 *
 * The four presets are the shared vocabulary of this server line. The Custom
 * Search JSON API is read-only end to end — every tool here uses READ_ONLY,
 * including raw_request (the API has no write endpoint to reach) — but the
 * full set stays defined so a future tool picks a preset instead of inventing
 * hint combinations.
 */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

export const UPDATE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
} as const;
