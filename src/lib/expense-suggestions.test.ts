import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysToDateKey,
  buildExpenseSuggestions,
  formatMonthStartQuestion,
  getSuggestionHistoryStart,
  isMonthStartSnoozed,
  matchExpenseTemplates,
  monthStartReminderStorageKey,
  parseMonthStartReminderMemory,
  selectVisibleMonthStartSuggestions,
  type ExpenseTemplate,
  type SuggestionExpenseInput,
} from "./expense-suggestions.ts";

const LUQUI = "luqui";
const TAMI = "tami";

function expense(
  overrides: Partial<SuggestionExpenseInput> &
    Pick<SuggestionExpenseInput, "descripcion" | "fecha" | "mesLiquidacion">
): SuggestionExpenseInput {
  return {
    monto: 1000,
    categoria: "servicios",
    pagadoPor: LUQUI,
    ...overrides,
  };
}

function names(templates: readonly { displayName: string }[]) {
  return templates.map((template) => template.displayName);
}

test("getSuggestionHistoryStart keeps six settlement months before the active month", () => {
  assert.equal(getSuggestionHistoryStart("2026-11"), "2026-05");
  assert.equal(getSuggestionHistoryStart("2026-01"), "2025-07");
  assert.equal(getSuggestionHistoryStart("2026-13"), null);
  assert.equal(getSuggestionHistoryStart("noviembre"), null);
});

test("month-start suggestions ignore empty months and fold case and spaces", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-05-02", mesLiquidacion: "2026-05", monto: 10000 }),
      expense({ descripcion: "Verdulería", fecha: "2026-06-04", mesLiquidacion: "2026-06", categoria: "comida" }),
      expense({
        descripcion: "  edesur  ",
        fecha: "2026-07-03T12:00:00.000Z",
        mesLiquidacion: "2026-07",
        monto: 11000,
      }),
      expense({ descripcion: "EDESUR", fecha: "2026-09-04", mesLiquidacion: "2026-09", monto: 12000 }),
      expense({ descripcion: "Edesur", fecha: "2026-10-20", mesLiquidacion: "2026-10", monto: 99999 }),
    ],
  });

  assert.equal(suggestions.monthStart.length, 1);
  assert.equal(suggestions.monthStart[0]?.displayName, "Edesur");
  assert.equal(suggestions.monthStart[0]?.normalizedName, "edesur");
  assert.equal(suggestions.monthStart[0]?.categoria, "servicios");
  assert.equal(suggestions.monthStart[0]?.pagadoPor, LUQUI);
  assert.equal(suggestions.monthStart[0]?.monthCount, 3);
  assert.equal(suggestions.monthStart[0]?.lastAmount, 99999);
  assert.equal(suggestions.monthStart[0]?.lastMonthKey, "2026-10");
  assert.deepEqual(names(suggestions.frequent), []);
});

test("the most repeated spelling wins over a later one-off capitalization", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-06" }),
      expense({ descripcion: "Edesur", fecha: "2026-08-02", mesLiquidacion: "2026-08" }),
      expense({ descripcion: "edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10" }),
    ],
  });

  assert.equal(suggestions.monthStart[0]?.displayName, "Edesur");
});

test("two early months are not enough and the active month does not create the habit", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Expensas", fecha: "2026-09-01", mesLiquidacion: "2026-09", categoria: "para-la-casa" }),
      expense({ descripcion: "Expensas", fecha: "2026-10-03", mesLiquidacion: "2026-10", categoria: "para-la-casa" }),
      expense({ descripcion: "Expensas", fecha: "2026-11-02", mesLiquidacion: "2026-11", categoria: "para-la-casa" }),
    ],
  });

  assert.deepEqual(suggestions.monthStart, []);
});

test("a charge after day 7 is not a month-start bill and becomes a frequent chip after three months", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-08", mesLiquidacion: "2026-06", monto: 10 }),
      expense({ descripcion: "Edesur", fecha: "2026-08-18", mesLiquidacion: "2026-08", monto: 20 }),
      expense({ descripcion: "Edesur", fecha: "2026-10-15", mesLiquidacion: "2026-10", monto: 30 }),
    ],
  });

  assert.deepEqual(suggestions.monthStart, []);
  assert.equal(suggestions.frequent[0]?.displayName, "Edesur");
  assert.equal(suggestions.frequent[0]?.transactionCount, 3);
  assert.equal(suggestions.frequent[0]?.monthCount, 3);
});

test("day 7 still counts as the beginning of the settlement month", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "ABL", fecha: "2026-06-07", mesLiquidacion: "2026-06" }),
      expense({ descripcion: "ABL", fecha: "2026-08-07", mesLiquidacion: "2026-08" }),
      expense({ descripcion: "ABL", fecha: "2026-10-07", mesLiquidacion: "2026-10" }),
    ],
  });

  assert.equal(suggestions.monthStart[0]?.displayName, "ABL");
  assert.equal(suggestions.monthStart[0]?.monthCount, 3);
});

test("the same name in another category does not fill the month-start quota", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Expensas", fecha: "2026-06-02", mesLiquidacion: "2026-06", categoria: "servicios" }),
      expense({ descripcion: "Expensas", fecha: "2026-08-02", mesLiquidacion: "2026-08", categoria: "servicios" }),
      expense({ descripcion: "Expensas", fecha: "2026-10-02", mesLiquidacion: "2026-10", categoria: "para-la-casa" }),
    ],
  });

  assert.deepEqual(suggestions.monthStart, []);
});

test("two charges in one month keep that month from counting as a fixed bill", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-06", monto: 1 }),
      expense({ descripcion: "Edesur", fecha: "2026-06-04", mesLiquidacion: "2026-06", monto: 2 }),
      expense({ descripcion: "Edesur", fecha: "2026-08-01", mesLiquidacion: "2026-08" }),
      expense({ descripcion: "Edesur", fecha: "2026-10-01", mesLiquidacion: "2026-10" }),
    ],
  });

  assert.deepEqual(suggestions.monthStart, []);
});

test("another person's history does not become this user's template", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-06", pagadoPor: TAMI }),
      expense({ descripcion: "Edesur", fecha: "2026-08-02", mesLiquidacion: "2026-08", pagadoPor: TAMI }),
      expense({ descripcion: "Edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10", pagadoPor: TAMI }),
    ],
  });

  assert.deepEqual(suggestions, { monthStart: [], frequent: [], autocomplete: [] });
});

test("charges outside the active-month window are ignored", () => {
  const insideWindow = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-04-02", mesLiquidacion: "2026-04" }),
      expense({ descripcion: "Edesur", fecha: "2026-05-02", mesLiquidacion: "2026-05" }),
      expense({ descripcion: "Edesur", fecha: "2026-07-02", mesLiquidacion: "2026-07" }),
      expense({ descripcion: "Edesur", fecha: "2026-12-02", mesLiquidacion: "2026-12" }),
    ],
  });

  assert.deepEqual(insideWindow.monthStart, []);
  assert.deepEqual(
    buildExpenseSuggestions({
      activeMonth: "no-es-un-mes",
      userId: LUQUI,
      expenses: [expense({ descripcion: "Edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10" })],
    }),
    { monthStart: [], frequent: [], autocomplete: [] }
  );
});

test("a date that does not belong to the settlement month is not an early-month hit", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-07" }),
      expense({ descripcion: "Edesur", fecha: "2026-08-02", mesLiquidacion: "2026-08" }),
      expense({ descripcion: "Edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10" }),
    ],
  });

  assert.deepEqual(suggestions.monthStart, []);
});

test("frequent chips skip month-start bills and rank by repetition", () => {
  const carrefour = ["2026-08-02", "2026-08-14", "2026-09-03", "2026-09-18", "2026-10-05", "2026-11-02"];
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      ...carrefour.map((fecha) =>
        expense({
          descripcion: fecha.endsWith("14") ? "  carrefour " : "Carrefour",
          fecha,
          mesLiquidacion: fecha.slice(0, 7),
          categoria: "comida",
          monto: 4000,
        })
      ),
      expense({ descripcion: "Farmacity", fecha: "2026-09-11", mesLiquidacion: "2026-09", categoria: "salud" }),
      expense({ descripcion: "Farmacity", fecha: "2026-09-20", mesLiquidacion: "2026-09", categoria: "salud" }),
      expense({ descripcion: "Farmacity", fecha: "2026-10-11", mesLiquidacion: "2026-10", categoria: "salud" }),
      expense({ descripcion: "Farmacity", fecha: "2026-10-21", mesLiquidacion: "2026-10", categoria: "salud" }),
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-06" }),
      expense({ descripcion: "Edesur", fecha: "2026-08-02", mesLiquidacion: "2026-08" }),
      expense({ descripcion: "Edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10" }),
      expense({ descripcion: "Regalo", fecha: "2026-10-19", mesLiquidacion: "2026-10", categoria: "regalos" }),
    ],
  });

  assert.deepEqual(names(suggestions.frequent), ["Carrefour", "Farmacity"]);
  assert.equal(suggestions.frequent[0]?.categoria, "comida");
  assert.equal(suggestions.frequent[0]?.transactionCount, 6);
  assert.equal(suggestions.monthStart[0]?.displayName, "Edesur");
  assert.equal(
    suggestions.autocomplete.some((template) => template.normalizedName === "edesur"),
    true
  );
  assert.equal(
    suggestions.autocomplete.some((template) => template.normalizedName === "regalo"),
    false
  );
});

test("three purchases in a single month stay out of the chips and remain searchable", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Carrefour", fecha: "2026-11-02", mesLiquidacion: "2026-11", categoria: "comida" }),
      expense({ descripcion: "Carrefour", fecha: "2026-11-09", mesLiquidacion: "2026-11", categoria: "comida" }),
      expense({ descripcion: "Carrefour", fecha: "2026-11-16", mesLiquidacion: "2026-11", categoria: "comida" }),
    ],
  });

  assert.deepEqual(suggestions.frequent, []);
  assert.equal(suggestions.autocomplete[0]?.displayName, "Carrefour");
  assert.equal(suggestions.autocomplete[0]?.transactionCount, 3);
});

test("ñ stays distinct from n when grouping suggestions", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Peña", fecha: "2026-08-02", mesLiquidacion: "2026-08", categoria: "salidas-ocio" }),
      expense({ descripcion: "Peña", fecha: "2026-08-12", mesLiquidacion: "2026-08", categoria: "salidas-ocio" }),
      expense({ descripcion: "Peña", fecha: "2026-10-02", mesLiquidacion: "2026-10", categoria: "salidas-ocio" }),
      expense({ descripcion: "Peña", fecha: "2026-10-12", mesLiquidacion: "2026-10", categoria: "salidas-ocio" }),
      expense({ descripcion: "Pena", fecha: "2026-08-03", mesLiquidacion: "2026-08", categoria: "salidas-ocio" }),
      expense({ descripcion: "Pena", fecha: "2026-08-13", mesLiquidacion: "2026-08", categoria: "salidas-ocio" }),
      expense({ descripcion: "Pena", fecha: "2026-10-03", mesLiquidacion: "2026-10", categoria: "salidas-ocio" }),
      expense({ descripcion: "Pena", fecha: "2026-10-13", mesLiquidacion: "2026-10", categoria: "salidas-ocio" }),
    ],
  });

  assert.deepEqual(names(suggestions.frequent).sort(), ["Pena", "Peña"]);
});

test("zero, invalid and blank expenses never become templates", () => {
  const suggestions = buildExpenseSuggestions({
    activeMonth: "2026-11",
    userId: LUQUI,
    expenses: [
      expense({ descripcion: "Edesur", fecha: "2026-06-02", mesLiquidacion: "2026-06", monto: 0 }),
      expense({ descripcion: "Edesur", fecha: "2026-08-02", mesLiquidacion: "2026-08", monto: Number.NaN }),
      expense({ descripcion: "...", fecha: "2026-10-02", mesLiquidacion: "2026-10" }),
      expense({ descripcion: "Edesur", fecha: "2026-10-02", mesLiquidacion: "2026-10", categoria: "  " }),
    ],
  });

  assert.deepEqual(suggestions, { monthStart: [], frequent: [], autocomplete: [] });
});

test("visible month-start cards follow the active month, dismissal and snooze", () => {
  const edesur = {
    normalizedName: "edesur",
    displayName: "Edesur",
    categoria: "servicios",
    pagadoPor: LUQUI,
    lastAmount: 12000,
    lastMonthKey: "2026-10",
    lastDate: "2026-10-04",
    transactionCount: 3,
    monthCount: 3,
  } satisfies ExpenseTemplate;
  const expensas = {
    ...edesur,
    normalizedName: "expensas",
    displayName: "Expensas",
    categoria: "para-la-casa",
    lastAmount: 84500,
  } satisfies ExpenseTemplate;

  assert.deepEqual(
    selectVisibleMonthStartSuggestions({
      suggestions: [edesur, expensas],
      activeMonthExpenses: [{ descripcion: "  EDESUR " }],
      dismissedNames: [],
      snoozeUntil: null,
      today: "2026-11-20",
    }).map((template) => template.displayName),
    ["Expensas"]
  );
  assert.deepEqual(
    selectVisibleMonthStartSuggestions({
      suggestions: [edesur, expensas],
      activeMonthExpenses: [],
      dismissedNames: ["Expensas"],
      snoozeUntil: null,
      today: "2026-11-20",
    }).map((template) => template.displayName),
    ["Edesur"]
  );
  assert.deepEqual(
    selectVisibleMonthStartSuggestions({
      suggestions: [edesur],
      activeMonthExpenses: [],
      dismissedNames: [],
      snoozeUntil: "2026-11-23",
      today: "2026-11-20",
    }),
    []
  );
  assert.equal(
    selectVisibleMonthStartSuggestions({
      suggestions: [edesur],
      activeMonthExpenses: [],
      dismissedNames: [],
      snoozeUntil: "2026-11-23",
      today: "2026-11-23",
    }).length,
    1
  );
  assert.equal(isMonthStartSnoozed("2026-11-20", "manana"), false);
});

test("name matches prefer the prefix and then frequency", () => {
  const carrefour = template({
    normalizedName: "carrefour",
    displayName: "Carrefour",
    transactionCount: 4,
    lastDate: "2026-10-02",
  });
  const superCarrefour = template({
    normalizedName: "super carrefour",
    displayName: "Super Carrefour",
    transactionCount: 9,
    lastDate: "2026-11-02",
  });
  const carne = template({
    normalizedName: "carne",
    displayName: "Carne",
    transactionCount: 8,
    lastDate: "2026-11-01",
  });

  assert.deepEqual(
    matchExpenseTemplates([superCarrefour, carrefour], "  CAR ").map((item) => item.displayName),
    ["Carrefour", "Super Carrefour"]
  );
  assert.deepEqual(
    matchExpenseTemplates([carne, carrefour], "car").map((item) => item.displayName),
    ["Carne", "Carrefour"]
  );
  assert.deepEqual(matchExpenseTemplates([carrefour], "   "), []);
  assert.deepEqual(matchExpenseTemplates([carrefour], "zzz"), []);
  assert.equal(matchExpenseTemplates([carrefour, superCarrefour, carne], "car", 1).length, 1);
});

test("month-start copy and reminder storage stay tied to the active month", () => {
  assert.equal(formatMonthStartQuestion(["Edesur"]), "¿Cargamos Edesur de este mes?");
  assert.equal(
    formatMonthStartQuestion(["Edesur", "Expensas"]),
    "¿Cargamos Edesur y Expensas de este mes?"
  );
  assert.equal(
    formatMonthStartQuestion(["Edesur", "Expensas", "ABL"]),
    "¿Cargamos Edesur, Expensas y ABL de este mes?"
  );
  assert.equal(
    formatMonthStartQuestion(["Edesur", "Expensas", "ABL", "OSDE"]),
    "¿Cargamos Edesur, Expensas y 2 más de este mes?"
  );
  assert.equal(formatMonthStartQuestion([]), "");
  assert.equal(
    monthStartReminderStorageKey("hogar", LUQUI, "2026-11"),
    "mi-cucha:month-start:hogar:luqui:2026-11"
  );
  assert.deepEqual(parseMonthStartReminderMemory(null), { dismissedNames: [], snoozeUntil: null });
  assert.deepEqual(parseMonthStartReminderMemory("{"), { dismissedNames: [], snoozeUntil: null });
  assert.deepEqual(
    parseMonthStartReminderMemory(
      JSON.stringify({ dismissedNames: ["edesur", ""], snoozeUntil: "2026-11-23" })
    ),
    { dismissedNames: ["edesur"], snoozeUntil: "2026-11-23" }
  );
  assert.equal(addDaysToDateKey("2026-11-20", 3), "2026-11-23");
  assert.equal(addDaysToDateKey("2026-11-30", 3), "2026-12-03");
  assert.equal(addDaysToDateKey("2026-11-31", 1), null);
});

function template(overrides: Partial<ExpenseTemplate> & Pick<ExpenseTemplate, "normalizedName" | "displayName">): ExpenseTemplate {
  return {
    categoria: "comida",
    pagadoPor: LUQUI,
    lastAmount: 1000,
    lastMonthKey: "2026-10",
    lastDate: "2026-10-02",
    transactionCount: 2,
    monthCount: 2,
    ...overrides,
  };
}
