import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActiveYearStats,
  buildRollingMonthlyAverage,
  formatMonthSpanLabel,
  type ComparisonMonthInput,
} from "./comparison-metrics.ts";

function month(
  monthKey: string,
  total: number,
  expenses: ComparisonMonthInput["expenses"] = []
): ComparisonMonthInput {
  return { monthKey, total, expenses };
}

function expense(categoria: string, monto: number) {
  return { categoria, monto };
}

test("formatMonthSpanLabel keeps a single month, a same-year span and a year boundary readable", () => {
  assert.equal(formatMonthSpanLabel("2026-01", "2026-01"), "ene 2026");
  assert.equal(formatMonthSpanLabel("2026-01", "2026-03"), "ene – mar 2026");
  assert.equal(formatMonthSpanLabel("2025-04", "2026-03"), "abr 2025 – mar 2026");
});

test("rolling average crosses the year, counts empty months and always divides by 12", () => {
  const result = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: [
      month("2025-03", 9999),
      month("2025-04", 1200),
      month("2026-01", 0),
      month("2026-03", 2400),
    ],
  });

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assert.equal(result.startMonthKey, "2025-04");
  assert.equal(result.endMonthKey, "2026-03");
  assert.equal(result.monthCount, 12);
  assert.equal(result.total, 3600);
  assert.equal(result.average, 300);
});

test("rolling average ends at the active month and ignores the chart months outside that window", () => {
  const months = [
    month("2024-11", 5000),
    month("2025-02", 8000),
    month("2025-04", 1200),
    month("2026-02", 2400),
    month("2026-03", 0),
    month("2026-06", 9000),
  ];
  const result = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months,
    expectedMonthKeys: months.map((entry) => entry.monthKey),
  });

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assert.equal(result.total, 3600);
  assert.equal(result.average, 300);
  assert.notEqual(result.average, 9000);
});

test("a chart page that omits an expected month is not a valid rolling average", () => {
  const history = [
    month("2024-06", 100),
    month("2024-07", 100),
    month("2025-04", 1200),
    month("2026-03", 2400),
  ];
  const visiblePage = history.slice(0, 2);
  const expectedMonthKeys = history.map((entry) => entry.monthKey);
  const fromHistory = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: history,
    expectedMonthKeys,
  });
  const fromViewport = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: visiblePage,
    expectedMonthKeys,
  });

  assert.equal(fromHistory.status, "ready");
  assert.equal(fromViewport.status, "incomplete");

  if (fromHistory.status !== "ready" || fromViewport.status !== "incomplete") {
    return;
  }

  assert.equal(fromHistory.average, 300);
  assert.equal("average" in fromViewport, false);
});

test("a failed or non-finite load inside the rolling window is not treated as zero", () => {
  const loaded = [month("2026-03", 1200), month("2025-12", 0)];
  const failedInside = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: loaded,
    failedMonthKeys: ["2025-06"],
  });
  const missingExpected = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: loaded,
    expectedMonthKeys: ["2026-03", "2025-12", "2025-11"],
  });
  const nonFinite = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: [month("2026-03", Number.NaN), month("2026-02", 1200)],
  });
  const failedOutside = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: [month("2026-03", 1200)],
    failedMonthKeys: ["2024-01"],
    expectedMonthKeys: ["2026-03", "2024-01"],
  });

  assert.equal(failedInside.status, "incomplete");
  assert.equal(missingExpected.status, "incomplete");
  assert.equal(nonFinite.status, "incomplete");
  assert.equal(failedOutside.status, "ready");

  if (failedOutside.status !== "ready") {
    return;
  }

  assert.equal(failedOutside.average, 100);
});

test("an empty rolling window is a real zero average, and an invalid active month is not", () => {
  const empty = buildRollingMonthlyAverage({
    activeMonth: "2026-01",
    months: [],
  });
  const invalid = buildRollingMonthlyAverage({
    activeMonth: "2026-13",
    months: [month("2026-01", 5000)],
  });

  assert.equal(empty.status, "ready");
  assert.equal(invalid.status, "invalid");

  if (empty.status !== "ready") {
    return;
  }

  assert.equal(empty.startMonthKey, "2025-02");
  assert.equal(empty.endMonthKey, "2026-01");
  assert.equal(empty.total, 0);
  assert.equal(empty.average, 0);
  assert.equal(empty.monthCount, 12);
});

test("rolling average rounds the monthly figure to cents", () => {
  const result = buildRollingMonthlyAverage({
    activeMonth: "2026-12",
    months: [month("2026-12", 100)],
  });

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assert.equal(result.total, 100);
  assert.equal(result.average, 8.33);
  assert.equal(result.monthCount, 12);
});

test("year total runs from January through the active month and stops there", () => {
  const months = [
    month("2025-12", 8000, [expense("regalos", 8000)]),
    month("2026-01", 1000, [expense("supermercado", 1000)]),
    month("2026-02", 0, []),
    month("2026-03", 2500, [expense("servicios", 2500)]),
    month("2026-04", 9999, [expense("ropa", 9999)]),
  ];
  const march = buildActiveYearStats({
    activeMonth: "2026-03",
    months,
    expectedMonthKeys: months.map((entry) => entry.monthKey),
  });
  const january = buildActiveYearStats({
    activeMonth: "2026-01",
    months,
    expectedMonthKeys: ["2026-01"],
  });

  assert.equal(march.status, "ready");
  assert.equal(january.status, "ready");

  if (march.status !== "ready" || january.status !== "ready") {
    return;
  }

  assert.equal(march.startMonthKey, "2026-01");
  assert.equal(march.endMonthKey, "2026-03");
  assert.equal(march.total, 3500);
  assert.equal(march.topCategory?.categoria, "servicios");
  assert.equal(january.startMonthKey, "2026-01");
  assert.equal(january.endMonthKey, "2026-01");
  assert.equal(january.total, 1000);
  assert.equal(january.topCategory?.categoria, "supermercado");
});

test("December uses the calendar year as a sum, not the rolling monthly average", () => {
  const result = buildActiveYearStats({
    activeMonth: "2026-12",
    months: [month("2026-01", 12000, [expense("comida", 12000)])],
  });
  const average = buildRollingMonthlyAverage({
    activeMonth: "2026-12",
    months: [month("2026-01", 12000)],
  });

  assert.equal(result.status, "ready");
  assert.equal(average.status, "ready");

  if (result.status !== "ready" || average.status !== "ready") {
    return;
  }

  assert.equal(result.startMonthKey, "2026-01");
  assert.equal(result.endMonthKey, "2026-12");
  assert.equal(result.total, 12000);
  assert.equal(average.total, 12000);
  assert.equal(average.average, 1000);
  assert.notEqual(result.total, average.average);
});

test("the year category follows amount, not how often it appears", () => {
  const result = buildActiveYearStats({
    activeMonth: "2026-03",
    months: [
      month("2026-02", 100, [
        expense("comida", 20),
        expense("comida", 20),
        expense("comida", 20),
        expense("comida", 20),
        expense("comida", 20),
      ]),
      month("2026-03", 250, [expense("transporte", 250)]),
    ],
  });

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assert.equal(result.topCategory?.categoria, "transporte");
  assert.equal(result.topCategory?.total, 250);
  assert.equal(result.total, 350);
});

test("tied category amounts use catalog order and then the name", () => {
  const catalogTie = buildActiveYearStats({
    activeMonth: "2026-02",
    months: [
      month("2026-01", 200, [expense("salud", 100), expense("comida", 100)]),
      month("2026-02", 0, []),
    ],
  });
  const unknownTie = buildActiveYearStats({
    activeMonth: "2026-01",
    months: [month("2026-01", 80, [expense("zeta", 40), expense("alfa", 40)])],
  });

  assert.equal(catalogTie.status, "ready");
  assert.equal(unknownTie.status, "ready");

  if (catalogTie.status !== "ready" || unknownTie.status !== "ready") {
    return;
  }

  assert.equal(catalogTie.topCategory?.categoria, "comida");
  assert.equal(catalogTie.topCategory?.label, "Comida");
  assert.equal(unknownTie.topCategory?.categoria, "alfa");
  assert.equal(unknownTie.topCategory?.label, "alfa");
});

test("a year without spending is zero and has no leading category", () => {
  const result = buildActiveYearStats({
    activeMonth: "2026-03",
    months: [month("2026-02", 0, [])],
  });

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    return;
  }

  assert.equal(result.total, 0);
  assert.equal(result.topCategory, null);
});

test("year stats stay incomplete when a month in the active year failed to load", () => {
  const base = {
    activeMonth: "2026-03",
    months: [
      month("2026-01", 1000, [expense("comida", 1000)]),
      month("2026-03", 500, [expense("servicios", 500)]),
    ],
  };
  const failedInside = buildActiveYearStats({
    ...base,
    failedMonthKeys: ["2026-02"],
  });
  const missingExpected = buildActiveYearStats({
    ...base,
    expectedMonthKeys: ["2026-01", "2026-02", "2026-03"],
  });
  const nonFiniteExpense = buildActiveYearStats({
    activeMonth: "2026-03",
    months: [month("2026-03", 500, [expense("servicios", Number.POSITIVE_INFINITY)])],
  });
  const failedOutside = buildActiveYearStats({
    activeMonth: "2026-03",
    months: [month("2026-03", 500, [expense("servicios", 500)])],
    failedMonthKeys: ["2025-11"],
    expectedMonthKeys: ["2026-03", "2025-11"],
  });
  const rollingStillReady = buildRollingMonthlyAverage({
    activeMonth: "2026-03",
    months: base.months,
    failedMonthKeys: ["2024-02"],
  });

  assert.equal(failedInside.status, "incomplete");
  assert.equal(missingExpected.status, "incomplete");
  assert.equal(nonFiniteExpense.status, "incomplete");
  assert.equal(failedOutside.status, "ready");
  assert.equal(rollingStillReady.status, "ready");

  if (failedOutside.status !== "ready") {
    return;
  }

  assert.equal(failedOutside.total, 500);
  assert.equal(failedOutside.topCategory?.categoria, "servicios");
});

test("a partial chart page does not become the year total", () => {
  const history = [
    month("2025-12", 4000, [expense("regalos", 4000)]),
    month("2026-01", 1000, [expense("supermercado", 1000)]),
    month("2026-03", 2000, [expense("servicios", 2000)]),
  ];
  const visiblePage = [history[0]!];
  const expectedMonthKeys = history.map((entry) => entry.monthKey);
  const fromHistory = buildActiveYearStats({
    activeMonth: "2026-03",
    months: history,
    expectedMonthKeys,
  });
  const fromViewport = buildActiveYearStats({
    activeMonth: "2026-03",
    months: visiblePage,
    expectedMonthKeys,
  });

  assert.equal(fromHistory.status, "ready");
  assert.equal(fromViewport.status, "incomplete");

  if (fromHistory.status !== "ready") {
    return;
  }

  assert.equal(fromHistory.total, 3000);
  assert.equal(fromHistory.topCategory?.categoria, "servicios");
});

test("conflicting copies of the same month are incomplete for both windows", () => {
  const months = [month("2026-03", 10, [expense("comida", 10)]), month("2026-03", 20, [expense("comida", 20)])];

  assert.equal(buildRollingMonthlyAverage({ activeMonth: "2026-03", months }).status, "incomplete");
  assert.equal(buildActiveYearStats({ activeMonth: "2026-03", months }).status, "incomplete");
});

test("an invalid active month does not turn the year into zeros", () => {
  const result = buildActiveYearStats({
    activeMonth: null,
    months: [month("2026-03", 100, [expense("comida", 100)])],
  });

  assert.deepEqual(result, { status: "invalid" });
});
