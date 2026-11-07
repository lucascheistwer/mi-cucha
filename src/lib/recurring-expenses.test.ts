import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecurringExpenseStats,
  filterRecurringExpenses,
  getRecurringExpenseWindow,
  normalizeExpenseDescription,
  type RecurringExpenseSource,
  type RecurringExpenseSourceMonth,
} from "./recurring-expenses.ts";

function month(
  monthKey: string,
  expenses: readonly RecurringExpenseSource[],
  label = monthKey
): RecurringExpenseSourceMonth {
  return { monthKey, label, expenses };
}

function expense(descripcion: string, monto: number): RecurringExpenseSource {
  return { descripcion, monto };
}

test("normalizeExpenseDescription folds case, spaces, vowel accents and edge punctuation", () => {
  assert.equal(normalizeExpenseDescription("  Netflix.  "), "netflix");
  assert.equal(normalizeExpenseDescription("¡NETFLIX!"), "netflix");
  assert.equal(normalizeExpenseDescription("Fármacia"), "farmacia");
  assert.equal(normalizeExpenseDescription("Pingüino"), "pinguino");
  assert.equal(normalizeExpenseDescription("  Peña  "), "peña");
  assert.equal(normalizeExpenseDescription("pre-pago"), "pre-pago");
  assert.equal(normalizeExpenseDescription("Alquiler noviembre"), "alquiler noviembre");
  assert.equal(normalizeExpenseDescription("OSDE (prepaga)"), "osde (prepaga)");
  assert.equal(normalizeExpenseDescription("..."), "");
});

test("getRecurringExpenseWindow rolls across the year and keeps 12 months", () => {
  assert.deepEqual(getRecurringExpenseWindow("2026-01"), {
    startMonthKey: "2025-02",
    endMonthKey: "2026-01",
  });
  assert.deepEqual(getRecurringExpenseWindow("2025-12"), {
    startMonthKey: "2025-01",
    endMonthKey: "2025-12",
  });
  assert.equal(getRecurringExpenseWindow("2026-13"), null);
});

test("buildRecurringExpenseStats requires 3 transactions in 2 distinct months", () => {
  const activeMonth = "2026-11";
  const oneMonthBurst = buildRecurringExpenseStats(
    [month("2026-11", [expense("Supermercado", 10), expense("Supermercado", 20), expense("Supermercado", 30)])],
    { activeMonth }
  );
  const twoTransactions = buildRecurringExpenseStats(
    [month("2026-10", [expense("Luz", 10)]), month("2026-11", [expense("Luz", 10)])],
    { activeMonth }
  );
  const eligible = buildRecurringExpenseStats(
    [
      month("2026-10", [expense("Internet", 40), expense("Internet", 60)]),
      month("2026-11", [expense("Internet", 30)]),
    ],
    { activeMonth }
  );

  assert.deepEqual(oneMonthBurst, []);
  assert.deepEqual(twoTransactions, []);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]?.transactionCount, 3);
  assert.equal(eligible[0]?.monthCount, 2);
  assert.equal(eligible[0]?.months[0]?.transactionCount, 2);
  assert.equal(eligible[0]?.months[0]?.total, 100);
  assert.equal(eligible[0]?.latestAmount, 30);
});

test("buildRecurringExpenseStats uses the active month as the end of a rolling year", () => {
  const stats = buildRecurringExpenseStats(
    [
      month("2025-01", [expense("Seguro", 100), expense("Seguro", 100), expense("Seguro", 100)]),
      month("2025-02", [expense("Seguro", 10), expense("Seguro", 10)]),
      month("2026-01", [expense("Seguro", 5)]),
      month("2026-02", [expense("Fuera", 1), expense("Fuera", 1), expense("Fuera", 1)]),
    ],
    { activeMonth: "2026-01" }
  );

  assert.equal(stats.length, 1);
  assert.equal(stats[0]?.normalizedName, "seguro");
  assert.equal(stats[0]?.transactionCount, 3);
  assert.deepEqual(
    stats[0]?.months.map((entry) => entry.monthKey),
    ["2025-02", "2026-01"]
  );
  assert.equal(stats[0]?.totalAmount, 25);
});

test("buildRecurringExpenseStats ignores amounts outside the window", () => {
  const stats = buildRecurringExpenseStats(
    [
      month("2024-01", [expense("Expensas", 1000)]),
      month("2026-09", [expense("Expensas", 10)]),
      month("2026-10", [expense("Expensas", 20)]),
      month("2026-11", [expense("Expensas", 30)]),
    ],
    { activeMonth: "2026-11" }
  );

  assert.equal(stats.length, 1);
  assert.equal(stats[0]?.transactionCount, 3);
  assert.equal(stats[0]?.totalAmount, 60);
  assert.deepEqual(
    stats[0]?.months.map((entry) => entry.monthKey),
    ["2026-09", "2026-10", "2026-11"]
  );
});

test("buildRecurringExpenseStats groups conservative variants and keeps ñ apart", () => {
  const stored = expense("  Netflix.  ", 10);
  const stats = buildRecurringExpenseStats(
    [
      month("2026-10", [
        stored,
        expense("  Netflix.  ", 10),
        expense("Niño", 5),
        expense("Nino", 5),
        expense("Nino", 5),
      ]),
      month("2026-11", [
        expense("netflix", 10),
        expense("Niño", 5),
        expense("Niño", 5),
        expense("Nino", 5),
        expense("Fármacia", 8),
        expense("farmacia", 2),
      ]),
      month("2026-08", [expense("Pingüino", 3), expense("farmacia", 4)]),
      month("2026-07", [expense("pinguino", 3), expense("pinguino", 3)]),
      month("2026-06", [expense("Alquiler", 50)]),
      month("2026-11", [expense("Alquiler", 50), expense("Alquiler", 50), expense("Alquiler noviembre", 50)]),
    ],
    { activeMonth: "2026-11" }
  );
  const byName = new Map(stats.map((entry) => [entry.normalizedName, entry]));

  assert.equal(stored.descripcion, "  Netflix.  ");
  assert.equal(byName.get("netflix")?.transactionCount, 3);
  assert.equal(byName.get("netflix")?.displayName, "Netflix.");
  assert.equal(byName.get("niño")?.transactionCount, 3);
  assert.equal(byName.get("nino")?.monthCount, 2);
  assert.equal(byName.get("farmacia")?.transactionCount, 3);
  assert.equal(byName.get("farmacia")?.months.find((entry) => entry.monthKey === "2026-11")?.total, 10);
  assert.equal(byName.get("pinguino")?.transactionCount, 3);
  assert.equal(byName.get("alquiler")?.transactionCount, 3);
  assert.equal(byName.has("alquiler noviembre"), false);
  assert.equal(byName.has("nino"), true);
});

test("buildRecurringExpenseStats sums a month and reports gaps without filling zeros", () => {
  const stats = buildRecurringExpenseStats(
    [
      month("2026-01", [expense("Expensas", 19.99), expense("Expensas", 0.02)], "enero de 2026"),
      month("2026-04", [expense("Expensas", 10)], "abril de 2026"),
    ],
    { activeMonth: "2026-11" }
  );

  assert.equal(stats.length, 1);
  assert.equal(stats[0]?.months[0]?.total, 20.01);
  assert.equal(stats[0]?.months[0]?.transactionCount, 2);
  assert.equal(stats[0]?.totalAmount, 30.01);
  assert.equal(stats[0]?.averageAmount, 15.005);
  assert.equal(stats[0]?.trendAmount, -10.01);
  assert.equal(stats[0]?.trendBaselineAmount, 20.01);
  assert.equal(stats[0]?.trendBaselineLabel, "enero de 2026");
  assert.equal(stats[0]?.trendSkipsMonths, 2);
  assert.equal(stats[0]?.seriesHasGap, true);
  assert.equal(stats[0]?.months.length, 2);
});

test("buildRecurringExpenseStats returns every eligible group past the old cap of 6", () => {
  const october = month("2026-10", []);
  const november = month("2026-11", []);

  for (let index = 1; index <= 7; index += 1) {
    october.expenses = [
      ...october.expenses,
      expense(`Gasto ${index}`, index * 10),
      expense(`Gasto ${index}`, index * 10),
    ];
    november.expenses = [...november.expenses, expense(`Gasto ${index}`, index * 10)];
  }

  const stats = buildRecurringExpenseStats([october, november], { activeMonth: "2026-11" });

  assert.equal(stats.length, 7);
  assert.deepEqual(
    stats.map((entry) => entry.displayName),
    ["Gasto 7", "Gasto 6", "Gasto 5", "Gasto 4", "Gasto 3", "Gasto 2", "Gasto 1"]
  );
});

test("buildRecurringExpenseStats returns an empty list when nothing qualifies", () => {
  assert.deepEqual(buildRecurringExpenseStats([], { activeMonth: "2026-11" }), []);
  assert.deepEqual(
    buildRecurringExpenseStats([month("2026-11", [expense("Una vez", 10)])], { activeMonth: "2026-11" }),
    []
  );
  assert.deepEqual(
    buildRecurringExpenseStats(
      [month("2026-11", [expense("Una vez", 10), expense("Una vez", 10), expense("Una vez", 10)])],
      { activeMonth: "no-es-un-mes" }
    ),
    []
  );
});

test("filterRecurringExpenses matches folded text and preserves ñ", () => {
  const expenses = [{ normalizedName: "niño" }, { normalizedName: "farmacia" }, { normalizedName: "pre-pago" }];

  assert.deepEqual(filterRecurringExpenses(expenses, "   "), expenses);
  assert.deepEqual(
    filterRecurringExpenses(expenses, "FÁRMACIA").map((entry) => entry.normalizedName),
    ["farmacia"]
  );
  assert.deepEqual(
    filterRecurringExpenses(expenses, "niño").map((entry) => entry.normalizedName),
    ["niño"]
  );
  assert.deepEqual(filterRecurringExpenses(expenses, "nino"), []);
  assert.deepEqual(filterRecurringExpenses(expenses, "zzz"), []);
});
