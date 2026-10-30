import assert from "node:assert/strict";
import test from "node:test";

import { LIST_PAGE_SIZE, sliceOneBasedPage, slicePage } from "./list-pagination.ts";

test("slicePage keeps the first page inside the shared page size", () => {
  const slice = slicePage(["a", "b", "c", "d", "e", "f"], 0, LIST_PAGE_SIZE);

  assert.deepEqual(slice.items, ["a", "b", "c", "d", "e"]);
  assert.equal(slice.pageNumber, 1);
  assert.equal(slice.totalPages, 2);
  assert.equal(slice.canGoBack, false);
  assert.equal(slice.canGoForward, true);
});

test("slicePage clamps a page past the end", () => {
  const slice = slicePage(["a", "b"], 4, 5);

  assert.deepEqual(slice.items, ["a", "b"]);
  assert.equal(slice.page, 0);
  assert.equal(slice.totalPages, 1);
  assert.equal(slice.canGoForward, false);
});

test("sliceOneBasedPage uses the same window as the expense ledger", () => {
  const slice = sliceOneBasedPage([1, 2, 3, 4, 5, 6, 7], 2, LIST_PAGE_SIZE);

  assert.deepEqual(slice.items, [6, 7]);
  assert.equal(slice.pageNumber, 2);
  assert.equal(slice.canGoBack, true);
});
