// Agrupa gastos del hogar por nombre para Estadísticas.
// No lee viajes ni escribe descripciones: solo normaliza una copia para comparar.
import { addMonthsToMonthKey } from "@/lib/date-helpers";

export const RECURRING_WINDOW_MONTHS = 12;
export const RECURRING_MIN_TRANSACTIONS = 3;
export const RECURRING_MIN_DISTINCT_MONTHS = 2;

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const EDGE_PUNCTUATION_PATTERN = /^[\s.…,;:!?¡¿"'“”‘’«»\-–—]+|[\s.…,;:!?¡¿"'“”‘’«»\-–—]+$/u;

export type RecurringExpenseSource = {
  descripcion: string;
  monto: number;
};

export type RecurringExpenseSourceMonth = {
  monthKey: string;
  label: string;
  expenses: readonly RecurringExpenseSource[];
};

export type RecurringExpenseMonthPoint = {
  monthKey: string;
  label: string;
  total: number;
  transactionCount: number;
};

export type RecurringExpenseStats = {
  normalizedName: string;
  displayName: string;
  monthCount: number;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  latestAmount: number;
  latestMonthKey: string;
  latestMonthLabel: string;
  trendAmount: number | null;
  trendBaselineAmount: number | null;
  trendBaselineMonthKey: string | null;
  trendBaselineLabel: string | null;
  trendSkipsMonths: number;
  seriesHasGap: boolean;
  months: RecurringExpenseMonthPoint[];
};

export type RecurringExpenseWindow = {
  startMonthKey: string;
  endMonthKey: string;
};

type SpellingCandidate = {
  text: string;
  count: number;
  latestMonthKey: string;
  latestExpenseIndex: number;
};

type ExpenseGroup = {
  spellings: Map<string, SpellingCandidate>;
  months: Map<string, RecurringExpenseMonthPoint>;
  transactionCount: number;
};

export function normalizeExpenseDescription(description: string) {
  let value = description.trim().replace(/\s+/g, " ");
  let previous = "";

  while (value && value !== previous) {
    previous = value;
    value = value.replace(EDGE_PUNCTUATION_PATTERN, "").trim().replace(/\s+/g, " ");
  }

  return stripVowelAccents(value.toLocaleLowerCase("es-AR"));
}

export function getRecurringExpenseWindow(
  activeMonth: string,
  windowSize = RECURRING_WINDOW_MONTHS
): RecurringExpenseWindow | null {
  if (!MONTH_KEY_PATTERN.test(activeMonth) || windowSize < 1) {
    return null;
  }

  return {
    startMonthKey: addMonthsToMonthKey(activeMonth, -(windowSize - 1)),
    endMonthKey: activeMonth,
  };
}

export function filterRecurringExpenses<T extends { normalizedName: string }>(
  expenses: readonly T[],
  query: string
) {
  const normalizedQuery = normalizeExpenseDescription(query);

  if (!normalizedQuery) {
    return [...expenses];
  }

  return expenses.filter((expense) => expense.normalizedName.includes(normalizedQuery));
}

export function buildRecurringExpenseStats(
  months: readonly RecurringExpenseSourceMonth[],
  options: { activeMonth: string; windowSize?: number }
): RecurringExpenseStats[] {
  const window = getRecurringExpenseWindow(options.activeMonth, options.windowSize);

  if (!window) {
    return [];
  }

  const groups = new Map<string, ExpenseGroup>();

  months.forEach((month) => {
    if (!MONTH_KEY_PATTERN.test(month.monthKey) || !isInsideWindow(month.monthKey, window)) {
      return;
    }

    month.expenses.forEach((expense, expenseIndex) => {
      if (!Number.isFinite(expense.monto)) {
        return;
      }

      const displayCandidate = expense.descripcion.trim();
      const normalizedName = normalizeExpenseDescription(displayCandidate);

      if (!normalizedName) {
        return;
      }

      const group = groups.get(normalizedName) ?? {
        spellings: new Map<string, SpellingCandidate>(),
        months: new Map<string, RecurringExpenseMonthPoint>(),
        transactionCount: 0,
      };
      group.transactionCount += 1;

      const spelling = group.spellings.get(displayCandidate) ?? {
        text: displayCandidate,
        count: 0,
        latestMonthKey: month.monthKey,
        latestExpenseIndex: expenseIndex,
      };
      spelling.count += 1;

      if (
        month.monthKey > spelling.latestMonthKey ||
        (month.monthKey === spelling.latestMonthKey && expenseIndex < spelling.latestExpenseIndex)
      ) {
        spelling.latestMonthKey = month.monthKey;
        spelling.latestExpenseIndex = expenseIndex;
      }

      group.spellings.set(displayCandidate, spelling);

      const currentMonth = group.months.get(month.monthKey) ?? {
        monthKey: month.monthKey,
        label: month.label,
        total: 0,
        transactionCount: 0,
      };
      currentMonth.total = roundCurrencyAmount(currentMonth.total + expense.monto);
      currentMonth.transactionCount += 1;
      group.months.set(month.monthKey, currentMonth);
      groups.set(normalizedName, group);
    });
  });

  return Array.from(groups.entries())
    .map(([normalizedName, group]) => toRecurringExpenseStats(normalizedName, group))
    .filter((expense): expense is RecurringExpenseStats => expense !== null)
    .sort(compareRecurringExpenses);
}

function toRecurringExpenseStats(
  normalizedName: string,
  group: ExpenseGroup
): RecurringExpenseStats | null {
  if (
    group.transactionCount < RECURRING_MIN_TRANSACTIONS ||
    group.months.size < RECURRING_MIN_DISTINCT_MONTHS
  ) {
    return null;
  }

  const recurringMonths = Array.from(group.months.values()).sort((firstMonth, secondMonth) =>
    firstMonth.monthKey.localeCompare(secondMonth.monthKey)
  );
  const totalAmount = roundCurrencyAmount(
    recurringMonths.reduce((runningTotal, month) => runningTotal + month.total, 0)
  );
  const latestMonth = recurringMonths[recurringMonths.length - 1];
  const previousMonth = recurringMonths[recurringMonths.length - 2] ?? null;
  const trendSkipsMonths = previousMonth
    ? monthIndex(latestMonth.monthKey) - monthIndex(previousMonth.monthKey) - 1
    : 0;

  return {
    normalizedName,
    displayName: chooseDisplayName(group.spellings),
    monthCount: recurringMonths.length,
    transactionCount: group.transactionCount,
    totalAmount,
    averageAmount: totalAmount / recurringMonths.length,
    latestAmount: latestMonth.total,
    latestMonthKey: latestMonth.monthKey,
    latestMonthLabel: latestMonth.label,
    trendAmount: previousMonth
      ? roundCurrencyAmount(latestMonth.total - previousMonth.total)
      : null,
    trendBaselineAmount: previousMonth?.total ?? null,
    trendBaselineMonthKey: previousMonth?.monthKey ?? null,
    trendBaselineLabel: previousMonth?.label ?? null,
    trendSkipsMonths,
    seriesHasGap: recurringMonths.some((month, index) => {
      const earlierMonth = recurringMonths[index - 1];

      return earlierMonth
        ? monthIndex(month.monthKey) - monthIndex(earlierMonth.monthKey) > 1
        : false;
    }),
    months: recurringMonths,
  };
}

function chooseDisplayName(spellings: Map<string, SpellingCandidate>) {
  const candidates = Array.from(spellings.values()).sort(
    (firstSpelling, secondSpelling) =>
      secondSpelling.count - firstSpelling.count ||
      secondSpelling.latestMonthKey.localeCompare(firstSpelling.latestMonthKey) ||
      firstSpelling.latestExpenseIndex - secondSpelling.latestExpenseIndex ||
      firstSpelling.text.localeCompare(secondSpelling.text, "es")
  );

  return candidates[0]?.text ?? "";
}

function compareRecurringExpenses(firstExpense: RecurringExpenseStats, secondExpense: RecurringExpenseStats) {
  return (
    secondExpense.monthCount - firstExpense.monthCount ||
    secondExpense.transactionCount - firstExpense.transactionCount ||
    secondExpense.totalAmount - firstExpense.totalAmount ||
    secondExpense.latestMonthKey.localeCompare(firstExpense.latestMonthKey) ||
    firstExpense.displayName.localeCompare(secondExpense.displayName, "es")
  );
}

function isInsideWindow(monthKey: string, window: RecurringExpenseWindow) {
  return monthKey >= window.startMonthKey && monthKey <= window.endMonthKey;
}

function monthIndex(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return year * 12 + (month - 1);
}

function roundCurrencyAmount(value: number) {
  return Number(value.toFixed(2));
}

function stripVowelAccents(value: string) {
  return value
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u");
}
