import assert from "node:assert/strict";
import test from "node:test";

import { listMonthKeysInSpan } from "./month-series.ts";

test("listMonthKeysInSpan fills gaps and keeps every month in the covered period", () => {
  assert.deepEqual(listMonthKeysInSpan(["2026-03", "2026-01"]), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(listMonthKeysInSpan(["2025-11", "2026-02"]), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
});

test("listMonthKeysInSpan does not trim a span longer than a year", () => {
  const span = listMonthKeysInSpan(["2025-01", "2026-02"]);

  assert.equal(span.length, 14);
  assert.equal(span[0], "2025-01");
  assert.equal(span.at(-1), "2026-02");
  assert.equal(span.includes("2025-08"), true);
});

test("listMonthKeysInSpan ignores invalid keys and duplicate months", () => {
  assert.deepEqual(listMonthKeysInSpan([]), []);
  assert.deepEqual(listMonthKeysInSpan(["2026-13", "no-es-un-mes"]), []);
  assert.deepEqual(listMonthKeysInSpan(["2026-05", "2026-05"]), ["2026-05"]);
});
