// Métricas de la comparación en Estadísticas.
// Usan gastoTotal del hogar en ARS, por mes de liquidación. No incluyen viajes.
import { addMonthsToMonthKey, formatShortMonthLabel } from "@/lib/date-helpers";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

export const ROLLING_AVERAGE_MONTHS = 12;

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ComparisonExpense = {
  categoria: string;
  monto: number;
};

export type ComparisonMonthInput = {
  monthKey: string;
  total: number;
  expenses?: readonly ComparisonExpense[];
};

export type ComparisonMetricsInput = {
  activeMonth: string | null | undefined;
  months: readonly ComparisonMonthInput[];
  failedMonthKeys?: readonly string[];
  expectedMonthKeys?: readonly string[];
};

export type CategorySpend = {
  categoria: string;
  label: string;
  icon: string;
  total: number;
};

type ReadyWindow = {
  status: "ready";
  startMonthKey: string;
  endMonthKey: string;
};

type IncompleteWindow = {
  status: "incomplete";
  startMonthKey: string;
  endMonthKey: string;
};

type InvalidWindow = {
  status: "invalid";
};

export type RollingMonthHighlight = {
  monthKey: string;
  total: number;
  expenseCount: number;
  averageExpense: number;
};

export type RollingComparison =
  | (ReadyWindow & {
      average: number;
      total: number;
      monthCount: typeof ROLLING_AVERAGE_MONTHS;
      topCategory: CategorySpend | null;
      peakMonth: RollingMonthHighlight | null;
      calmMonth: RollingMonthHighlight | null;
    })
  | IncompleteWindow
  | InvalidWindow;

const categoryCatalog = new Map<string, { label: string; icon: string; index: number }>(
  EXPENSE_CATEGORIES.map((category, index) => [
    category.value,
    { label: category.label, icon: category.icon, index },
  ])
);

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function listRollingMonthKeys(activeMonth: string) {
  const monthKeys: string[] = [];

  for (let offset = ROLLING_AVERAGE_MONTHS - 1; offset >= 0; offset -= 1) {
    monthKeys.push(addMonthsToMonthKey(activeMonth, -offset));
  }

  return monthKeys;
}

function windowBounds(monthKeys: readonly string[]) {
  return {
    startMonthKey: monthKeys[0] ?? "",
    endMonthKey: monthKeys[monthKeys.length - 1] ?? "",
  };
}

function indexWindowMonths(
  monthKeys: readonly string[],
  input: ComparisonMetricsInput,
  options: { requireExpenses: boolean }
) {
  const window = new Set(monthKeys);
  const failedMonthKeys = input.failedMonthKeys ?? [];

  if (failedMonthKeys.some((monthKey) => window.has(monthKey))) {
    return null;
  }

  const indexed = new Map<string, ComparisonMonthInput>();

  for (const month of input.months) {
    if (!window.has(month.monthKey)) {
      continue;
    }

    if (!Number.isFinite(month.total)) {
      return null;
    }

    if (options.requireExpenses && !month.expenses) {
      return null;
    }

    for (const expense of month.expenses ?? []) {
      if (!Number.isFinite(expense.monto)) {
        return null;
      }
    }

    const existing = indexed.get(month.monthKey);

    if (existing) {
      const sameTotal = existing.total === month.total;
      const sameExpenses = expenseSignature(existing.expenses) === expenseSignature(month.expenses);

      if (!sameTotal || !sameExpenses) {
        return null;
      }

      continue;
    }

    indexed.set(month.monthKey, month);
  }

  const expectedMonthKeys = input.expectedMonthKeys ?? [];

  if (expectedMonthKeys.some((monthKey) => window.has(monthKey) && !indexed.has(monthKey))) {
    return null;
  }

  return indexed;
}

function expenseSignature(expenses: readonly ComparisonExpense[] | undefined) {
  return (expenses ?? [])
    .map((expense) => `${expense.categoria}\u0000${expense.monto}`)
    .join("\u0001");
}

function describeCategory(categoria: string) {
  const normalized = categoria.trim();
  const known = categoryCatalog.get(normalized);

  if (known) {
    return {
      categoria: normalized,
      label: known.label,
      icon: known.icon,
      index: known.index,
    };
  }

  return {
    categoria: normalized || "sin-categoria",
    label: normalized || "Sin categoría",
    icon: "✨",
    index: EXPENSE_CATEGORIES.length,
  };
}

function topCategoryByAmount(months: readonly ComparisonMonthInput[]) {
  const totals = new Map<string, CategorySpend & { index: number }>();

  for (const month of months) {
    for (const expense of month.expenses ?? []) {
      const category = describeCategory(expense.categoria);
      const current = totals.get(category.categoria) ?? {
        categoria: category.categoria,
        label: category.label,
        icon: category.icon,
        index: category.index,
        total: 0,
      };

      current.total = roundCurrency(current.total + expense.monto);
      totals.set(category.categoria, current);
    }
  }

  const ranked = [...totals.values()].sort((first, second) => {
    if (second.total !== first.total) {
      return second.total - first.total;
    }

    if (first.index !== second.index) {
      return first.index - second.index;
    }

    return first.label.localeCompare(second.label, "es") || first.categoria.localeCompare(second.categoria, "es");
  });

  const winner = ranked.find((category) => category.total > 0);

  if (!winner) {
    return null;
  }

  return {
    categoria: winner.categoria,
    label: winner.label,
    icon: winner.icon,
    total: winner.total,
  };
}

export function formatMonthSpanLabel(startMonthKey: string, endMonthKey: string) {
  const startLabel = formatShortMonthLabel(startMonthKey);
  const endLabel = formatShortMonthLabel(endMonthKey);
  const startYear = startMonthKey.slice(0, 4);
  const endYear = endMonthKey.slice(0, 4);

  if (startMonthKey === endMonthKey) {
    return `${startLabel} ${endYear}`;
  }

  if (startYear === endYear) {
    return `${startLabel} – ${endLabel} ${endYear}`;
  }

  return `${startLabel} ${startYear} – ${endLabel} ${endYear}`;
}

function monthHighlight(month: ComparisonMonthInput): RollingMonthHighlight {
  const expenseCount = month.expenses?.length ?? 0;

  return {
    monthKey: month.monthKey,
    total: month.total,
    expenseCount,
    averageExpense: expenseCount > 0 ? month.total / expenseCount : 0,
  };
}

function choosePeakMonth(months: readonly ComparisonMonthInput[]) {
  return months.reduce<RollingMonthHighlight | null>((peak, month) => {
    const candidate = monthHighlight(month);

    if (
      !peak ||
      candidate.total > peak.total ||
      (candidate.total === peak.total && candidate.monthKey > peak.monthKey)
    ) {
      return candidate;
    }

    return peak;
  }, null);
}

function chooseCalmMonth(months: readonly ComparisonMonthInput[]) {
  return months.reduce<RollingMonthHighlight | null>((calm, month) => {
    const candidate = monthHighlight(month);

    if (candidate.expenseCount <= 0) {
      return calm;
    }

    if (
      !calm ||
      candidate.averageExpense < calm.averageExpense ||
      (candidate.averageExpense === calm.averageExpense && candidate.monthKey > calm.monthKey)
    ) {
      return candidate;
    }

    return calm;
  }, null);
}

export function buildRollingComparison(input: ComparisonMetricsInput): RollingComparison {
  if (!input.activeMonth || !MONTH_KEY_PATTERN.test(input.activeMonth)) {
    return { status: "invalid" };
  }

  const monthKeys = listRollingMonthKeys(input.activeMonth);
  const bounds = windowBounds(monthKeys);
  const indexed = indexWindowMonths(monthKeys, input, { requireExpenses: true });

  if (!indexed) {
    return { status: "incomplete", ...bounds };
  }

  const months = monthKeys.flatMap((monthKey) => {
    const month = indexed.get(monthKey);

    return month ? [month] : [];
  });
  const total = roundCurrency(
    monthKeys.reduce((sum, monthKey) => sum + (indexed.get(monthKey)?.total ?? 0), 0)
  );

  return {
    status: "ready",
    ...bounds,
    total,
    average: roundCurrency(total / ROLLING_AVERAGE_MONTHS),
    monthCount: ROLLING_AVERAGE_MONTHS,
    topCategory: topCategoryByAmount(months),
    peakMonth: choosePeakMonth(months),
    calmMonth: chooseCalmMonth(months),
  };
}
