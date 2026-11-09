"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildActiveYearStats,
  buildRollingMonthlyAverage,
  formatMonthSpanLabel,
  type ActiveYearStats,
  type RollingMonthlyAverage,
} from "@/lib/comparison-metrics";
import { formatExpenseDate, formatMonthLabel, formatShortMonthLabel } from "@/lib/date-helpers";
import { listMonthKeysInSpan } from "@/lib/month-series";
import {
  RECURRING_WINDOW_MONTHS,
  buildRecurringExpenseStats,
  filterRecurringExpenses,
} from "@/lib/recurring-expenses";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseListItem, ExpensesDashboardPayload } from "@/types/expense";

type LoadState = {
  months: MonthStats[];
  activeMonth: string | null;
  expectedMonthKeys: string[];
  failedMonthKeys: string[];
  error: string;
  isLoading: boolean;
};

type MonthStats = {
  monthKey: string;
  label: string;
  total: number;
  expenseCount: number;
  averageExpense: number;
  paymentTotal: number;
  expenses: ExpenseListItem[];
  topExpenses: ExpenseListItem[];
  topCategory: {
    icon: string;
    label: string;
    total: number;
    percentage: number;
  } | null;
  topThreeTotal: number;
  topThreeShare: number;
  isCurrent: boolean;
  isFinalized: boolean;
};

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function roundCurrencyAmount(value: number) {
  return Number(value.toFixed(2));
}

function sortExpensesByAmountDesc(firstExpense: ExpenseListItem, secondExpense: ExpenseListItem) {
  return (
    secondExpense.monto - firstExpense.monto ||
    new Date(secondExpense.fecha).getTime() - new Date(firstExpense.fecha).getTime()
  );
}

function buildMonthStats(payload: ExpensesDashboardPayload): MonthStats {
  const biggestExpenses = [...payload.expenses].sort(sortExpensesByAmountDesc);
  const topExpenses = biggestExpenses.slice(0, 3);
  const topThreeTotal = roundCurrencyAmount(
    topExpenses.reduce((runningTotal, expense) => runningTotal + expense.monto, 0)
  );
  const topCategory = payload.summary.categorySummary[0] ?? null;

  return {
    monthKey: payload.currentMonth,
    label: formatMonthLabel(payload.currentMonth),
    total: payload.summary.gastoTotal,
    expenseCount: payload.expenses.length,
    averageExpense:
      payload.expenses.length > 0 ? payload.summary.gastoTotal / payload.expenses.length : 0,
    paymentTotal: payload.summary.paymentTotal,
    expenses: payload.expenses,
    topExpenses,
    topCategory: topCategory
      ? {
          icon: topCategory.icon,
          label: topCategory.label,
          total: topCategory.total,
          percentage: topCategory.percentage,
        }
      : null,
    topThreeTotal,
    topThreeShare:
      payload.summary.gastoTotal > 0 ? Math.round((topThreeTotal / payload.summary.gastoTotal) * 100) : 0,
    isCurrent: payload.monthState.isCurrent,
    isFinalized: payload.monthState.isFinalized,
  };
}

function formatDelta(currentTotal: number, previousTotal: number | null) {
  if (previousTotal === null) {
    return "primer mes";
  }

  const delta = currentTotal - previousTotal;

  if (Math.abs(delta) < 1) {
    return "igual";
  }

  return delta > 0 ? `+${formatCurrency(delta)}` : `-${formatCurrency(Math.abs(delta))}`;
}

function metricRangeLabel(metric: RollingMonthlyAverage | ActiveYearStats) {
  if (metric.status === "invalid") {
    return "";
  }

  return formatMonthSpanLabel(metric.startMonthKey, metric.endMonthKey);
}

function getDeltaTone(currentTotal: number, previousTotal: number | null) {
  if (previousTotal === null || Math.abs(currentTotal - previousTotal) < 1) {
    return "text-stone-500";
  }

  return currentTotal > previousTotal ? "text-rose-700" : "text-teal-700";
}

function emptyMonthStats(monthKey: string, activeMonth: string | null): MonthStats {
  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    total: 0,
    expenseCount: 0,
    averageExpense: 0,
    paymentTotal: 0,
    expenses: [],
    topExpenses: [],
    topCategory: null,
    topThreeTotal: 0,
    topThreeShare: 0,
    isCurrent: monthKey === activeMonth,
    isFinalized: false,
  };
}

function buildComparisonMonths(months: readonly MonthStats[], activeMonth: string | null) {
  const monthsByKey = new Map(months.map((month) => [month.monthKey, month]));

  return listMonthKeysInSpan(months.map((month) => month.monthKey)).map(
    (monthKey) => monthsByKey.get(monthKey) ?? emptyMonthStats(monthKey, activeMonth)
  );
}

type ChartMonth = {
  monthKey: string;
  label: string;
  total: number;
};

function formatTrendPercent(value: number) {
  const rounded = Math.round(value);

  if (!Number.isFinite(rounded)) {
    return null;
  }

  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

function MonthBarChart({
  months,
  selectedMonthKey,
  onSelectMonth,
  label,
}: {
  months: readonly ChartMonth[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  label: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollable = months.length > 12;
  const maxTotal = Math.max(0, ...months.map((month) => month.total));

  function moveSelection(direction: -1 | 1) {
    const selectedIndex = months.findIndex((month) => month.monthKey === selectedMonthKey);
    const nextIndex = selectedIndex + direction;

    if (nextIndex < 0 || nextIndex >= months.length) {
      return;
    }

    const nextMonth = months[nextIndex];

    if (!nextMonth) {
      return;
    }

    onSelectMonth(nextMonth.monthKey);
    const buttons = scrollerRef.current?.querySelectorAll("button");
    buttons?.[nextIndex]?.focus();
  }

  function scrollByPage(direction: -1 | 1) {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div>
      {scrollable ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Ver meses anteriores"
            onClick={() => scrollByPage(-1)}
            className="rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700"
          >
            ‹
          </button>
          <p className="truncate text-xs text-stone-500">
            {months[0]?.label} – {months[months.length - 1]?.label}
          </p>
          <button
            type="button"
            aria-label="Ver meses siguientes"
            onClick={() => scrollByPage(1)}
            className="rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700"
          >
            ›
          </button>
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        className={scrollable ? "overflow-x-auto" : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveSelection(-1);
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            moveSelection(1);
          }
        }}
      >
        <div
          className="flex h-44 items-end gap-1"
          role="group"
          aria-label={label}
          style={scrollable ? { minWidth: months.length * 40 } : undefined}
        >
          {months.map((month, index) => {
            const isSelected = month.monthKey === selectedMonthKey;
            const isZero = month.total <= 0;
            const height = !isZero && maxTotal > 0 ? Math.max((month.total / maxTotal) * 100, 8) : 0;
            const showYear = index === 0 || month.monthKey.endsWith("-01");

            return (
              <button
                key={month.monthKey}
                type="button"
                title={`${month.label}: ${formatCurrency(month.total)}`}
                aria-label={`${month.label}, ${formatCurrency(month.total)}`}
                aria-pressed={isSelected}
                onClick={() => onSelectMonth(month.monthKey)}
                className={`flex h-full flex-col items-center justify-end gap-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  scrollable ? "w-10 shrink-0" : "min-w-0 flex-1"
                }`}
              >
                <span className="flex h-32 w-full items-end">
                  <span
                    className={`w-full rounded-t-md ${isZero ? "h-1.5 bg-stone-400" : "bg-teal-500"} ${
                      isSelected ? "outline outline-2 outline-offset-1 outline-stone-950" : ""
                    }`}
                    style={isZero ? undefined : { height: `${height}%` }}
                  />
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] leading-none ${
                    isSelected ? "font-semibold text-stone-950" : "text-stone-500"
                  }`}
                >
                  {formatShortMonthLabel(month.monthKey)}
                </span>
                <span className="h-3 text-[9px] leading-none text-stone-400">
                  {showYear ? month.monthKey.slice(0, 4) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CompareStatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState<string | null>(null);
  const [recurringQuery, setRecurringQuery] = useState("");
  const [focusedRecurringMonth, setFocusedRecurringMonth] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    months: [],
    activeMonth: null,
    expectedMonthKeys: [],
    failedMonthKeys: [],
    error: "",
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadMonths() {
      const initialResponse = await fetch("/api/expenses", { cache: "no-store" });
      const initialPayload = await parseJson<ExpensesDashboardPayload & { error?: string }>(
        initialResponse
      );

      if (!initialResponse.ok || !initialPayload) {
        if (isMounted) {
          setState({
            months: [],
            activeMonth: null,
            expectedMonthKeys: [],
            failedMonthKeys: [],
            error: initialPayload?.error ?? "No pudimos cargar las estadísticas.",
            isLoading: false,
          });
        }
        return;
      }

      const expectedMonthKeys = initialPayload.availableMonths.map((month) => month.monthKey);
      const monthResults = await Promise.all(
        initialPayload.availableMonths.map(async (month) => {
          if (month.monthKey === initialPayload.currentMonth) {
            return { ok: true as const, payload: initialPayload };
          }

          try {
            const response = await fetch(`/api/expenses?mesLiquidacion=${month.monthKey}`, {
              cache: "no-store",
            });
            const payload = await parseJson<ExpensesDashboardPayload & { error?: string }>(response);

            if (!response.ok || !payload) {
              return {
                ok: false as const,
                monthKey: month.monthKey,
                error: payload?.error ?? "No pudimos cargar un mes histórico.",
              };
            }

            return { ok: true as const, payload };
          } catch {
            return {
              ok: false as const,
              monthKey: month.monthKey,
              error: "No pudimos cargar un mes histórico.",
            };
          }
        })
      );

      if (!isMounted) {
        return;
      }

      const failedMonths = monthResults.filter((result) => !result.ok);

      if (failedMonths.length > 0) {
        setState({
          months: [],
          activeMonth: initialPayload.activeMonth,
          expectedMonthKeys,
          failedMonthKeys: failedMonths.map((result) => result.monthKey),
          error: failedMonths[0]?.error ?? "No pudimos cargar las estadísticas.",
          isLoading: false,
        });
        return;
      }

      const months = monthResults
        .flatMap((result) => (result.ok ? [buildMonthStats(result.payload)] : []))
        .sort((firstMonth, secondMonth) => secondMonth.monthKey.localeCompare(firstMonth.monthKey));

      setSelectedMonth(initialPayload.currentMonth);
      setState({
        months,
        activeMonth: initialPayload.activeMonth,
        expectedMonthKeys,
        failedMonthKeys: [],
        error: "",
        isLoading: false,
      });
    }

    void loadMonths().catch((error: unknown) => {
      if (!isMounted) {
        return;
      }

      setState({
        months: [],
        activeMonth: null,
        expectedMonthKeys: [],
        failedMonthKeys: [],
        error: error instanceof Error ? error.message : "No pudimos cargar las estadísticas.",
        isLoading: false,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const comparisonMonths = useMemo(
    () => buildComparisonMonths(state.months, state.activeMonth),
    [state.activeMonth, state.months]
  );
  const comparisonInput = useMemo(
    () => ({
      activeMonth: state.activeMonth,
      months: state.months,
      failedMonthKeys: state.failedMonthKeys,
      expectedMonthKeys: state.expectedMonthKeys,
    }),
    [state.activeMonth, state.expectedMonthKeys, state.failedMonthKeys, state.months]
  );
  const rollingAverage = useMemo(
    () => buildRollingMonthlyAverage(comparisonInput),
    [comparisonInput]
  );
  const activeYear = useMemo(() => buildActiveYearStats(comparisonInput), [comparisonInput]);
  const recurringExpenses = useMemo(
    () =>
      state.activeMonth
        ? buildRecurringExpenseStats(state.months, { activeMonth: state.activeMonth })
        : [],
    [state.activeMonth, state.months]
  );
  const filteredRecurringExpenses = useMemo(
    () => filterRecurringExpenses(recurringExpenses, recurringQuery),
    [recurringExpenses, recurringQuery]
  );
  const visibleRecurringQuery = recurringQuery.trim();
  const selectedStats =
    comparisonMonths.find((month) => month.monthKey === selectedMonth) ??
    comparisonMonths[comparisonMonths.length - 1] ??
    null;
  const selectedComparisonIndex = selectedStats
    ? comparisonMonths.findIndex((month) => month.monthKey === selectedStats.monthKey)
    : -1;
  const previousComparisonMonth =
    selectedComparisonIndex > 0 ? comparisonMonths[selectedComparisonIndex - 1] ?? null : null;
  const peakMonth = state.months.reduce<MonthStats | null>(
    (currentPeakMonth, month) =>
      !currentPeakMonth || month.total > currentPeakMonth.total ? month : currentPeakMonth,
    null
  );
  const calmMonth = state.months
    .filter((month) => month.expenseCount > 0)
    .reduce<MonthStats | null>(
      (currentCalmMonth, month) =>
        !currentCalmMonth || month.averageExpense < currentCalmMonth.averageExpense
          ? month
          : currentCalmMonth,
      null
    );
  const mostRecurringExpense = recurringExpenses[0] ?? null;
  const selectedRecurringStats =
    recurringExpenses.find((expense) => expense.normalizedName === selectedRecurringExpense) ??
    mostRecurringExpense;
  const selectedRecurringIsVisible = filteredRecurringExpenses.some(
    (expense) => expense.normalizedName === selectedRecurringStats?.normalizedName
  );
  const focusedRecurringPoint =
    selectedRecurringStats?.months.find((month) => month.monthKey === focusedRecurringMonth) ??
    selectedRecurringStats?.months.at(-1) ??
    null;
  const trendPercentLabel =
    selectedRecurringStats?.trendPercent !== null &&
    selectedRecurringStats?.trendPercent !== undefined &&
    selectedRecurringStats.trendBaselineAmount
      ? formatTrendPercent(selectedRecurringStats.trendPercent)
      : null;

  if (state.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/70" />
        <div className="h-72 animate-pulse rounded-[2rem] bg-white/60" />
      </div>
    );
  }

  if (state.error) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-6 text-rose-800">
        <h1 className="text-lg font-semibold">No pudimos abrir las estadísticas.</h1>
        <p className="mt-2 text-sm leading-6">{state.error}</p>
      </section>
    );
  }

  const rollingRange = metricRangeLabel(rollingAverage);
  const yearRange = metricRangeLabel(activeYear);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              comparación
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
              Estadísticas
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 overflow-hidden rounded-[1.4rem] bg-stone-100">
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
                  promedio mensual
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                  {rollingAverage.status === "ready"
                    ? formatCurrency(rollingAverage.average)
                    : "No disponible"}
                </p>
                <p className="text-xs text-stone-600">
                  {rollingRange ? `últimos 12 meses · ${rollingRange}` : "últimos 12 meses"}
                </p>
              </div>
              <div className="border-t border-stone-200/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">total del año</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-stone-950">
                  {activeYear.status === "ready" ? formatCurrency(activeYear.total) : "No disponible"}
                </p>
                <p className="text-xs text-stone-600">{yearRange}</p>
              </div>
            </div>
            <div className="min-w-0 rounded-[1.4rem] bg-stone-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">mes pico</p>
              <p className="mt-1 text-sm font-semibold text-stone-950">
                {peakMonth ? peakMonth.label : "-"}
              </p>
              <p className="text-xs text-stone-600">
                {peakMonth ? formatCurrency(peakMonth.total) : ""}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.4rem] bg-teal-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">más liviano</p>
              <p className="mt-1 text-sm font-semibold text-teal-950">
                {calmMonth ? calmMonth.label : "-"}
              </p>
              <p className="text-xs text-teal-700">
                {calmMonth ? `${formatCurrency(calmMonth.averageExpense)} promedio` : ""}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.4rem] bg-stone-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">mayor importe</p>
              <p
                className="mt-1 truncate text-sm font-semibold text-stone-950"
                title={
                  activeYear.status === "ready" && activeYear.topCategory
                    ? activeYear.topCategory.label
                    : undefined
                }
              >
                {activeYear.status === "ready"
                  ? activeYear.topCategory
                    ? `${activeYear.topCategory.icon} ${activeYear.topCategory.label}`
                    : "-"
                  : "No disponible"}
              </p>
              {activeYear.status === "ready" && activeYear.topCategory ? (
                <p className="text-xs text-stone-600">{formatCurrency(activeYear.topCategory.total)}</p>
              ) : null}
              {yearRange ? <p className="text-xs leading-snug text-stone-500">{yearRange}</p> : null}
            </div>
            <div className="min-w-0 rounded-[1.4rem] bg-amber-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700">más recurrente</p>
              <p className="mt-1 truncate text-sm font-semibold text-amber-950">
                {mostRecurringExpense?.displayName ?? "-"}
              </p>
              <p className="text-xs text-amber-700">
                {mostRecurringExpense
                  ? `${mostRecurringExpense.monthCount} meses · ${mostRecurringExpense.transactionCount} veces`
                  : `sin repetidos en ${RECURRING_WINDOW_MONTHS} meses`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            Evolución mensual
          </h2>
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
            {comparisonMonths.length === 1 ? "1 mes" : `${comparisonMonths.length} meses`}
          </span>
        </div>

        {comparisonMonths.length === 0 || !selectedStats ? (
          <p className="mt-4 text-sm text-stone-500">Todavía no hay meses para mostrar.</p>
        ) : (
          <div className="mt-4">
            <MonthBarChart
              months={comparisonMonths}
              selectedMonthKey={selectedStats.monthKey}
              onSelectMonth={setSelectedMonth}
              label="Evolución mensual"
            />
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-[1.1rem] border border-teal-200 bg-teal-50 px-3 py-3"
              aria-live="polite"
            >
              <div>
                <p className="text-sm font-semibold text-stone-950">{selectedStats.label}</p>
                <p className={`text-xs ${getDeltaTone(selectedStats.total, previousComparisonMonth?.total ?? null)}`}>
                  {formatDelta(selectedStats.total, previousComparisonMonth?.total ?? null)} vs anterior
                </p>
                <p className="text-xs text-stone-600">
                  {selectedStats.expenseCount === 0
                    ? "sin gastos"
                    : selectedStats.expenseCount === 1
                      ? "1 gasto"
                      : `${selectedStats.expenseCount} gastos`}
                </p>
              </div>
              <p className="text-sm font-semibold text-stone-950">{formatCurrency(selectedStats.total)}</p>
            </div>
          </div>
        )}
      </section>

      {selectedStats ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-stone-950">
                {selectedStats.label}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {selectedStats.isFinalized ? "cerrado" : selectedStats.isCurrent ? "activo" : "histórico"}
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              {formatCurrency(selectedStats.total)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[1.2rem] bg-stone-100 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                promedio
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-950">
                {formatCurrency(selectedStats.averageExpense)}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-teal-50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                categoría líder
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-teal-950">
                {selectedStats.topCategory
                  ? `${selectedStats.topCategory.icon} ${selectedStats.topCategory.label}`
                  : "-"}
              </p>
              <p className="text-xs text-teal-700">
                {selectedStats.topCategory ? formatCurrency(selectedStats.topCategory.total) : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                Concentración
              </h3>
              <span className="text-xs font-medium text-stone-500">
                top 3 · {selectedStats.topThreeShare}%
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-teal-500 transition-[width]"
                style={{ width: `${Math.min(Math.max(selectedStats.topThreeShare, 6), 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Los 3 gastos más grandes suman {formatCurrency(selectedStats.topThreeTotal)}.
            </p>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-stone-200 bg-white/80 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                3 gastos más grandes
              </h3>
              <span className="text-xs font-medium text-stone-500">
                {selectedStats.expenseCount} registrados
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {selectedStats.topExpenses.length > 0 ? (
                selectedStats.topExpenses.map((expense, index) => (
                  <div
                    key={expense._id}
                    className="flex items-center justify-between gap-3 rounded-[1.1rem] bg-stone-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                        top {index + 1}
                      </p>
                      <p className="truncate text-sm font-semibold text-stone-950">
                        {expense.descripcion}
                      </p>
                      <p className="text-xs text-stone-500">{formatExpenseDate(expense.fecha)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-stone-950">
                      {formatCurrency(expense.monto)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">Todavía no hay gastos para mostrar.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">
            Evolución por gasto
          </h2>
          <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
            {recurringExpenses.length === 1
              ? "1 recurrente"
              : `${recurringExpenses.length} recurrentes`}
          </span>
        </div>

        {recurringExpenses.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Ningún gasto repetido en este año.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50 p-3">
              <label htmlFor="recurring-expense-search" className="sr-only">
                Buscar gasto
              </label>
              <input
                id="recurring-expense-search"
                type="search"
                value={recurringQuery}
                onChange={(event) => setRecurringQuery(event.target.value)}
                placeholder="Buscar gasto"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600"
              />
              {visibleRecurringQuery ? (
                <p className="mt-2 text-xs text-stone-500">
                  {filteredRecurringExpenses.length} de {recurringExpenses.length}
                </p>
              ) : null}

              {filteredRecurringExpenses.length === 0 ? (
                <p className="mt-3 text-sm text-stone-600">
                  Ningún gasto coincide con «{visibleRecurringQuery}».
                </p>
              ) : (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto overscroll-contain">
                  {filteredRecurringExpenses.map((expense) => {
                    const isSelected = expense.normalizedName === selectedRecurringStats?.normalizedName;

                    return (
                      <button
                        key={expense.normalizedName}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (expense.normalizedName !== selectedRecurringStats?.normalizedName) {
                            setFocusedRecurringMonth(null);
                          }
                          setSelectedRecurringExpense(expense.normalizedName);
                        }}
                        className={`w-full rounded-[1.1rem] border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-teal-300 bg-teal-50"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-950">
                              {expense.displayName}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {expense.transactionCount} veces · {expense.monthCount} meses · último{" "}
                              {expense.latestMonthLabel}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-stone-950">
                            {formatCurrency(expense.latestAmount)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedRecurringStats && selectedRecurringIsVisible && focusedRecurringPoint ? (
              <div className="rounded-[1.4rem] border border-stone-300 bg-white p-3">
                <p className="truncate text-sm font-semibold text-stone-950">
                  {selectedRecurringStats.displayName}
                </p>

                <div className="mt-3">
                  <MonthBarChart
                    months={selectedRecurringStats.months}
                    selectedMonthKey={focusedRecurringPoint.monthKey}
                    onSelectMonth={setFocusedRecurringMonth}
                    label="Evolución del gasto"
                  />
                  <div
                    className="mt-3 flex items-center justify-between gap-3 rounded-[1.1rem] border border-teal-200 bg-teal-50 px-3 py-3"
                    aria-live="polite"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{focusedRecurringPoint.label}</p>
                      <p className="text-xs text-stone-600">
                        {focusedRecurringPoint.transactionCount === 0
                          ? "sin gastos"
                          : focusedRecurringPoint.transactionCount === 1
                            ? "1 gasto"
                            : `${focusedRecurringPoint.transactionCount} gastos sumados`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-stone-950">
                      {formatCurrency(focusedRecurringPoint.total)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[1.2rem] bg-stone-100 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                      promedio
                    </p>
                    <p className="mt-1 text-sm font-semibold text-stone-950">
                      {formatCurrency(selectedRecurringStats.averageAmount)}
                    </p>
                    <p className="text-[10px] text-stone-500">{RECURRING_WINDOW_MONTHS} meses</p>
                  </div>
                  <div className="rounded-[1.2rem] bg-teal-50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                      mes activo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-teal-950">
                      {formatCurrency(selectedRecurringStats.closingAmount)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] bg-amber-50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      tendencia
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${getDeltaTone(
                        selectedRecurringStats.closingAmount,
                        selectedRecurringStats.trendBaselineAmount
                      )}`}
                    >
                      {formatDelta(
                        selectedRecurringStats.closingAmount,
                        selectedRecurringStats.trendBaselineAmount
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-tight text-amber-800">
                      {trendPercentLabel ? `${trendPercentLabel} · ` : ""}vs mes anterior
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
