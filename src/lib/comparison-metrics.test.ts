import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRollingComparison,
  formatMonthSpanLabel,
  ROLLING_AVERAGE_MONTHS,
  type ComparisonMonthInput,
} from "./comparison-metrics.ts";
import { buildRecurringExpenseStats, getRecurringExpenseWindow } from "./recurring-expenses.ts";

function month(
  monthKey: string,
  total: number,
  expenses: ComparisonMonthInput["expenses"] = []
): ComparisonMonthInput {
  return { monthKey, total, expenses };
}

function expense(categoria: string, monto: number, descripcion = categoria) {
  return { categoria, monto, descripcion };
}

function readyComparison(input: Parameters<typeof buildRollingComparison>[0]) {
  const result = buildRollingComparison(input);

  assert.equal(result.status, "ready");

  if (result.status !== "ready") {
    throw new Error("expected a ready comparison");
  }

  return result;
}

test("formatMonthSpanLabel keeps a single month, a same-year span and a year boundary readable", () => {
  assert.equal(formatMonthSpanLabel("2026-01", "2026-01"), "ene 2026");
  assert.equal(formatMonthSpanLabel("2026-01", "2026-03"), "ene – mar 2026");
  assert.equal(formatMonthSpanLabel("2025-04", "2026-03"), "abr 2025 – mar 2026");
});

test("every comparison figure uses the same 12 months ending at the active month", () => {
  const result = readyComparison({
    activeMonth: "2026-03",
    months: [
      month("2025-03", 9000, [expense("regalos", 9000)]),
      month("2025-04", 1200, [expense("servicios", 1200)]),
      month("2026-01", 0, []),
      month("2026-02", 400, [expense("comida", 100), expense("comida", 100), expense("comida", 100), expense("comida", 100)]),
      month("2026-03", 2400, [expense("supermercado", 2400)]),
      month("2026-04", 8000, [expense("ropa", 8000)]),
    ],
  });
  const recurringWindow = getRecurringExpenseWindow("2026-03");

  assert.equal(result.startMonthKey, "2025-04");
  assert.equal(result.endMonthKey, "2026-03");
  assert.equal(result.monthCount, ROLLING_AVERAGE_MONTHS);
  assert.deepEqual(
    { startMonthKey: result.startMonthKey, endMonthKey: result.endMonthKey },
    recurringWindow
  );
  assert.equal(result.total, 4000);
  assert.equal(result.average, 333.33);
  assert.equal(result.topCategory?.categoria, "supermercado");
  assert.equal(result.peakMonth?.monthKey, "2026-03");
  assert.equal(result.peakMonth?.total, 2400);
  assert.equal(result.calmMonth?.monthKey, "2026-02");
  assert.equal(result.calmMonth?.averageExpense, 100);
});

test("a January active month crosses the year and drops the previous January and the next month", () => {
  const result = readyComparison({
    activeMonth: "2026-01",
    months: [
      month("2025-01", 7000, [expense("ropa", 7000)]),
      month("2025-02", 500, [expense("otros", 500)]),
      month("2025-12", 1500, [expense("comida", 1500)]),
      month("2026-01", 1000, [expense("supermercado", 1000)]),
      month("2026-02", 9000, [expense("regalos", 9000)]),
    ],
  });

  assert.equal(result.startMonthKey, "2025-02");
  assert.equal(result.endMonthKey, "2026-01");
  assert.equal(result.total, 3000);
  assert.equal(result.average, 250);
  assert.equal(result.topCategory?.categoria, "comida");
  assert.equal(result.peakMonth?.monthKey, "2025-12");
  assert.equal(result.calmMonth?.monthKey, "2025-02");
});

test("zeros stay in the divisor and the accumulated total, without becoming the lightest month or a category", () => {
  const result = readyComparison({
    activeMonth: "2026-12",
    months: [
      month("2026-05", 0, []),
      month("2026-12", 12000, [expense("comida", 12000)]),
    ],
  });

  assert.equal(result.monthCount, 12);
  assert.equal(result.total, 12000);
  assert.equal(result.average, 1000);
  assert.notEqual(result.total, result.average);
  assert.equal(result.topCategory?.categoria, "comida");
  assert.equal(result.peakMonth?.monthKey, "2026-12");
  assert.equal(result.calmMonth?.monthKey, "2026-12");
  assert.equal(result.calmMonth?.expenseCount, 1);
});

test("the category follows amount inside the window, not frequency or an older year", () => {
  const result = readyComparison({
    activeMonth: "2026-03",
    months: [
      month("2025-03", 5000, [expense("regalos", 5000)]),
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

  assert.equal(result.topCategory?.categoria, "transporte");
  assert.equal(result.topCategory?.total, 250);
  assert.equal(result.total, 350);
  assert.equal(result.calmMonth?.monthKey, "2026-02");
});

test("tied category amounts use catalog order and then the name", () => {
  const catalogTie = readyComparison({
    activeMonth: "2026-02",
    months: [month("2026-01", 200, [expense("salud", 100), expense("comida", 100)])],
  });
  const unknownTie = readyComparison({
    activeMonth: "2026-01",
    months: [month("2026-01", 80, [expense("zeta", 40), expense("alfa", 40)])],
  });

  assert.equal(catalogTie.topCategory?.categoria, "comida");
  assert.equal(unknownTie.topCategory?.categoria, "alfa");
});

test("tied peak and light months keep the newer month", () => {
  const result = readyComparison({
    activeMonth: "2026-03",
    months: [
      month("2026-01", 100, [expense("comida", 50), expense("comida", 50)]),
      month("2026-02", 100, [expense("servicios", 100)]),
      month("2026-03", 80, [expense("transporte", 40), expense("transporte", 40)]),
    ],
  });

  assert.equal(result.peakMonth?.monthKey, "2026-02");
  assert.equal(result.calmMonth?.monthKey, "2026-03");
  assert.equal(result.calmMonth?.averageExpense, 40);
});

test("an empty window is a real zero average and total, and an invalid active month is not", () => {
  const empty = readyComparison({ activeMonth: "2026-01", months: [] });
  const invalid = buildRollingComparison({
    activeMonth: "2026-13",
    months: [month("2026-01", 5000, [expense("comida", 5000)])],
  });

  assert.equal(empty.total, 0);
  assert.equal(empty.average, 0);
  assert.equal(empty.topCategory, null);
  assert.equal(empty.peakMonth, null);
  assert.equal(empty.calmMonth, null);
  assert.deepEqual(invalid, { status: "invalid" });
});

test("a failed load inside the shared window does not leave a partial peak, total or category", () => {
  const months = [
    month("2026-02", 1000, [expense("comida", 1000)]),
    month("2026-03", 500, [expense("servicios", 500)]),
  ];
  const failedInside = buildRollingComparison({
    activeMonth: "2026-03",
    months,
    failedMonthKeys: ["2025-06"],
  });
  const missingExpected = buildRollingComparison({
    activeMonth: "2026-03",
    months,
    expectedMonthKeys: ["2026-02", "2026-03", "2025-11"],
  });
  const nonFinite = buildRollingComparison({
    activeMonth: "2026-03",
    months: [month("2026-03", Number.NaN, [expense("servicios", 10)])],
  });
  const nonFiniteExpense = buildRollingComparison({
    activeMonth: "2026-03",
    months: [month("2026-03", 500, [expense("servicios", Number.POSITIVE_INFINITY)])],
  });
  const failedOutside = readyComparison({
    activeMonth: "2026-03",
    months: [month("2026-03", 500, [expense("servicios", 500)])],
    failedMonthKeys: ["2024-01"],
    expectedMonthKeys: ["2026-03", "2024-01"],
  });

  assert.equal(failedInside.status, "incomplete");
  assert.equal(missingExpected.status, "incomplete");
  assert.equal(nonFinite.status, "incomplete");
  assert.equal(nonFiniteExpense.status, "incomplete");
  assert.equal("peakMonth" in failedInside, false);
  assert.equal("average" in failedInside, false);
  assert.equal(failedOutside.total, 500);
  assert.equal(failedOutside.average, 41.67);
  assert.equal(failedOutside.topCategory?.categoria, "servicios");
  assert.equal(failedOutside.peakMonth?.monthKey, "2026-03");
});

test("a chart page that omits an expected month is not a valid comparison", () => {
  const history = [
    month("2024-06", 100, [expense("otros", 100)]),
    month("2025-04", 1200, [expense("servicios", 1200)]),
    month("2026-03", 2400, [expense("supermercado", 2400)]),
  ];
  const expectedMonthKeys = history.map((entry) => entry.monthKey);
  const fromHistory = readyComparison({
    activeMonth: "2026-03",
    months: history,
    expectedMonthKeys,
  });
  const fromViewport = buildRollingComparison({
    activeMonth: "2026-03",
    months: history.slice(0, 1),
    expectedMonthKeys,
  });

  assert.equal(fromViewport.status, "incomplete");
  assert.equal(fromHistory.total, 3600);
  assert.equal(fromHistory.average, 300);
  assert.equal(fromHistory.peakMonth?.monthKey, "2026-03");
});

test("conflicting copies of the same month leave the whole comparison incomplete", () => {
  const result = buildRollingComparison({
    activeMonth: "2026-03",
    months: [
      month("2026-03", 10, [expense("comida", 10)]),
      month("2026-03", 20, [expense("comida", 20)]),
    ],
  });

  assert.equal(result.status, "incomplete");
});

test("recurring names use that same window and zero months do not create one", () => {
  const activeMonth = "2026-03";
  const comparison = readyComparison({ activeMonth, months: [] });
  const stats = buildRecurringExpenseStats(
    [
      {
        monthKey: "2025-01",
        label: "enero de 2025",
        expenses: [expense("servicios", 10, "Expensas viejas"), expense("servicios", 10, "Expensas viejas"), expense("servicios", 10, "Expensas viejas")],
      },
      {
        monthKey: "2025-02",
        label: "febrero de 2025",
        expenses: [expense("servicios", 10, "Expensas viejas"), expense("servicios", 10, "Expensas viejas")],
      },
      {
        monthKey: "2025-08",
        label: "agosto de 2025",
        expenses: [],
      },
      {
        monthKey: "2026-02",
        label: "febrero de 2026",
        expenses: [expense("suscripciones", 20, "Internet"), expense("suscripciones", 20, "Internet")],
      },
      {
        monthKey: "2026-03",
        label: "marzo de 2026",
        expenses: [expense("suscripciones", 20, "Internet")],
      },
      {
        monthKey: "2026-04",
        label: "abril de 2026",
        expenses: [expense("servicios", 30, "Después"), expense("servicios", 30, "Después"), expense("servicios", 30, "Después")],
      },
    ],
    { activeMonth }
  );

  assert.equal(comparison.startMonthKey, "2025-04");
  assert.equal(stats.length, 1);
  assert.equal(stats[0]?.displayName, "Internet");
  assert.equal(stats[0]?.months[0]?.monthKey, comparison.startMonthKey);
  assert.equal(stats[0]?.months.at(-1)?.monthKey, comparison.endMonthKey);
  assert.equal(stats[0]?.months.find((entry) => entry.monthKey === "2025-08")?.transactionCount, 0);
  assert.equal(stats.some((entry) => entry.displayName === "Expensas viejas"), false);
  assert.equal(stats.some((entry) => entry.displayName === "Después"), false);
});
