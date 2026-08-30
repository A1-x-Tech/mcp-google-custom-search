import { test } from "node:test";
import assert from "node:assert/strict";
import { registerImageTools } from "./images.js";

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
  const client = { searchImages: make("searchImages") };
  const tools: Record<string, Handler> = {};
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      tools[name] = handler;
    },
  };
  registerImageTools(server as never, client as never);
  return { calls, tools };
}

test("registers the search_images tool", () => {
  const { tools } = harness();
  assert.deepEqual(Object.keys(tools), ["search_images"]);
});

test("search_images forwards the shared filters plus the image-only ones", async () => {
  const { calls, tools } = harness();
  await tools.search_images({
    query: "sunset",
    num: 3,
    safe: "active",
    rights: "cc_publicdomain",
    size: "xlarge",
    type: "photo",
    color_type: "trans",
    dominant_color: "orange",
  });
  assert.equal(calls[0].method, "searchImages");
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.query, "sunset");
  assert.equal(params.num, 3);
  assert.equal(params.safe, "active");
  assert.equal(params.rights, "cc_publicdomain");
  assert.equal(params.size, "xlarge");
  assert.equal(params.type, "photo");
  assert.equal(params.colorType, "trans");
  assert.equal(params.dominantColor, "orange");
});

test("image-only filters stay undefined when omitted", async () => {
  const { calls, tools } = harness();
  await tools.search_images({ query: "cat" });
  const params = calls[0].params[0] as Record<string, unknown>;
  assert.equal(params.size, undefined);
  assert.equal(params.type, undefined);
  assert.equal(params.colorType, undefined);
  assert.equal(params.dominantColor, undefined);
});

test("a client error is returned as an isError result, not thrown", async () => {
  const { tools } = harness({ throwOn: "searchImages" });
  const res = await tools.search_images({ query: "q" });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /boom/);
});

test("a paging window past result 100 is rejected before the client is called", async () => {
  const { calls, tools } = harness();
  const res = await tools.search_images({ query: "q", start: 100, num: 10 });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /start \+ num - 1 must stay <= 100/);
  assert.equal(calls.length, 0, "the API would answer 400 after burning a quota unit — never call it");
});
