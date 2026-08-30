import { test } from "node:test";
import assert from "node:assert/strict";
import { registerSearchTools } from "./search.js";
import { registerImageTools } from "./images.js";
import { registerRawTool } from "./raw.js";
import { READ_ONLY } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerSearchTools(server as never, {} as never);
  registerImageTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The expected hints are pinned per tool. Changing a tool's annotation must be
 * a conscious decision that updates this map. The Custom Search JSON API is
 * read-only end to end (one GET endpoint, no writes), so every tool —
 * raw_request included — carries READ_ONLY; a non-read-only tool appearing
 * here would mean the server started doing something this API cannot do.
 */
const EXPECTED: Record<string, Annotations> = {
  search: READ_ONLY,
  search_images: READ_ONLY,
  raw_request: READ_ONLY,
};

test("registers all three tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("everything stays read-only — the API has no write endpoint", () => {
  for (const [name, a] of Object.entries(ANN)) {
    assert.equal(a?.readOnlyHint, true, `${name} must be read-only`);
    assert.equal(a?.destructiveHint, false, `${name} must not be destructive`);
  }
});
