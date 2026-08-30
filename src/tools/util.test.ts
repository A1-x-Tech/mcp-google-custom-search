import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPageWindow,
  countryCodeSchema,
  dateRestrictSchema,
  DESTRUCTIVE,
  fail,
  languageCodeSchema,
  numSchema,
  ok,
  querySchema,
  READ_ONLY,
  startSchema,
  UPDATE,
  WRITE,
} from "./util.js";

test("languageCodeSchema accepts language codes and rejects junk", () => {
  const s = languageCodeSchema(); // factory → fresh schema
  assert.equal(s.safeParse("en").success, true);
  assert.equal(s.safeParse("zh-CN").success, true);
  assert.equal(s.safeParse("english").success, false);
  assert.equal(s.safeParse("e").success, false);
});

test("countryCodeSchema accepts 2-letter codes only", () => {
  const s = countryCodeSchema();
  assert.equal(s.safeParse("de").success, true);
  assert.equal(s.safeParse("DE").success, true);
  assert.equal(s.safeParse("deu").success, false);
});

test("dateRestrictSchema accepts the d/w/m/y format", () => {
  const s = dateRestrictSchema();
  assert.equal(s.safeParse("d7").success, true);
  assert.equal(s.safeParse("y1").success, true);
  assert.equal(s.safeParse("h3").success, false);
  assert.equal(s.safeParse("d0").success, false);
  assert.equal(s.safeParse("7d").success, false);
});

test("numSchema and startSchema pin the API's paging limits", () => {
  assert.equal(numSchema().safeParse(10).success, true);
  assert.equal(numSchema().safeParse(11).success, false);
  assert.equal(numSchema().safeParse(0).success, false);
  assert.equal(startSchema().safeParse(1).success, true);
  assert.equal(startSchema().safeParse(100).success, true);
  assert.equal(startSchema().safeParse(101).success, false);
});

test("checkPageWindow enforces start + num - 1 <= 100 across the two fields", () => {
  assert.doesNotThrow(() => checkPageWindow(undefined, undefined));
  assert.doesNotThrow(() => checkPageWindow(undefined, 10));
  assert.doesNotThrow(() => checkPageWindow(91, 10)); // results 91..100: the last full page
  assert.doesNotThrow(() => checkPageWindow(100, 1)); // exactly result 100
  assert.throws(() => checkPageWindow(92, 10), /start \+ num - 1 must stay <= 100/);
  assert.throws(() => checkPageWindow(100, 10), /results up to 109/);
});

test("checkPageWindow counts an omitted num as the API default of 10", () => {
  assert.doesNotThrow(() => checkPageWindow(91)); // 91..100 with the default page size
  assert.throws(() => checkPageWindow(92), /num=10 \(the API default\)/);
});

test("schema factories return independent schemas (no $ref dedup)", () => {
  assert.notEqual(querySchema(), querySchema());
  assert.notEqual(languageCodeSchema(), languageCodeSchema());
});

test("ok emits compact JSON; fail flags isError", () => {
  assert.equal((ok({ a: 1 }).content[0] as { text: string }).text, '{"a":1}');
  const f = fail(new Error("boom"));
  assert.equal(f.isError, true);
  assert.match((f.content[0] as { text: string }).text, /boom/);
});

test("fail appends the underlying cause when present", () => {
  const err = new Error("timeout", { cause: new Error("ECONNRESET") });
  const f = fail(err);
  assert.match((f.content[0] as { text: string }).text, /timeout \(ECONNRESET\)/);
});

test("the four annotation presets set all four hints explicitly", () => {
  assert.deepEqual(READ_ONLY, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(UPDATE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(DESTRUCTIVE, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});
