// Agrupa gastos del hogar por nombre para Estadísticas.
// No lee viajes ni escribe descripciones: solo normaliza una copia para comparar.
import { addMonthsToMonthKey, formatMonthLabel, formatShortMonthLabel } from "@/lib/date-helpers";

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
  shortLabel: string;
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
  closingAmount: number;
  trendAmount: number | null;
  trendPercent: number | null;
  trendBaselineAmount: number | null;
  trendBaselineMonthKey: string | null;
  trendBaselineLabel: string | null;
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

type ActualMonthTotal = {
  monthKey: string;
  label: string;
  total: number;
  transactionCount: number;
};

type ExpenseGroup = {
  spellings: Map<string, SpellingCandidate>;
  months: Map<string, ActualMonthTotal>;
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

export function recurringChangePercent(current: number, baseline: number) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return null;
  }

  if (baseline === 0) {
    return current === 0 ? 0 : null;
  }

  const percent = ((current - baseline) / Math.abs(baseline)) * 100;

  return Number.isFinite(percent) ? percent : null;
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
        months: new Map<string, ActualMonthTotal>(),
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
    .map(([normalizedName, group]) => toRecurringExpenseStats(normalizedName, group, window))
    .filter((expense): expense is RecurringExpenseStats => expense !== null)
    .sort(compareRecurringExpenses);
}

function toRecurringExpenseStats(
  normalizedName: string,
  group: ExpenseGroup,
  window: RecurringExpenseWindow
): RecurringExpenseStats | null {
  const actualMonthCount = group.months.size;

  if (
    group.transactionCount < RECURRING_MIN_TRANSACTIONS ||
    actualMonthCount < RECURRING_MIN_DISTINCT_MONTHS
  ) {
    return null;
  }

  const recurringMonths = listWindowMonthKeys(window).map((monthKey) => {
    const actualMonth = group.months.get(monthKey);

    return {
      monthKey,
      label: actualMonth?.label || formatMonthLabel(monthKey),
      shortLabel: formatShortMonthLabel(monthKey),
      total: actualMonth?.total ?? 0,
      transactionCount: actualMonth?.transactionCount ?? 0,
    };
  });
  const monthsWithExpenses = recurringMonths.filter((month) => month.transactionCount > 0);
  const latestMonth = monthsWithExpenses[monthsWithExpenses.length - 1];
  const closingMonth = recurringMonths[recurringMonths.length - 1];
  const previousCalendarMonth = recurringMonths[recurringMonths.length - 2] ?? null;

  if (!latestMonth || !closingMonth) {
    return null;
  }

  const totalAmount = roundCurrencyAmount(
    monthsWithExpenses.reduce((runningTotal, month) => runningTotal + month.total, 0)
  );

  return {
    normalizedName,
    displayName: chooseDisplayName(group.spellings),
    monthCount: monthsWithExpenses.length,
    transactionCount: group.transactionCount,
    totalAmount,
    averageAmount: totalAmount / recurringMonths.length,
    latestAmount: latestMonth.total,
    latestMonthKey: latestMonth.monthKey,
    latestMonthLabel: latestMonth.label,
    closingAmount: closingMonth.total,
    trendAmount: previousCalendarMonth
      ? roundCurrencyAmount(closingMonth.total - previousCalendarMonth.total)
      : null,
    trendPercent: previousCalendarMonth
      ? recurringChangePercent(closingMonth.total, previousCalendarMonth.total)
      : null,
    trendBaselineAmount: previousCalendarMonth?.total ?? null,
    trendBaselineMonthKey: previousCalendarMonth?.monthKey ?? null,
    trendBaselineLabel: previousCalendarMonth?.label ?? null,
    months: recurringMonths,
  };
}

function listWindowMonthKeys(window: RecurringExpenseWindow) {
  const monthKeys: string[] = [];
  let cursor = window.startMonthKey;

  while (monthKeys.length < 36 && cursor <= window.endMonthKey) {
    monthKeys.push(cursor);
    const nextMonth = addMonthsToMonthKey(cursor, 1);

    if (nextMonth <= cursor) {
      break;
    }

    cursor = nextMonth;
  }

  return monthKeys;
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
