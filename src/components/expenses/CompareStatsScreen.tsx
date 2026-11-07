"use client";

import { useEffect, useMemo, useState } from "react";

import { ListPagination } from "@/components/shared/ListPagination";
import { formatExpenseDate, formatMonthLabel } from "@/lib/date-helpers";
import { LIST_PAGE_SIZE, slicePage } from "@/lib/list-pagination";
import {
  RECURRING_WINDOW_MONTHS,
  buildRecurringExpenseStats,
  filterRecurringExpenses,
  type RecurringExpenseMonthPoint,
} from "@/lib/recurring-expenses";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseListItem, ExpensesDashboardPayload } from "@/types/expense";

type LoadState = {
  months: MonthStats[];
  activeMonth: string | null;
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

function getDeltaTone(currentTotal: number, previousTotal: number | null) {
  if (previousTotal === null || Math.abs(currentTotal - previousTotal) < 1) {
    return "text-stone-500";
  }

  return currentTotal > previousTotal ? "text-rose-700" : "text-teal-700";
}

function reservedRowCount(visibleCount: number, totalCount: number) {
  if (totalCount <= LIST_PAGE_SIZE) {
    return 0;
  }

  return Math.max(0, LIST_PAGE_SIZE - visibleCount);
}

function ComparisonMonthSlot() {
  return (
    <div aria-hidden="true" className="invisible w-full rounded-[1.3rem] border px-4 py-3">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-semibold">mes</p>
          <p className="mt-0.5 text-xs">vs anterior</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">$0</p>
          <p className="text-xs">0 gastos</p>
        </div>
      </div>
      <div className="mt-3 h-2.5" />
    </div>
  );
}

function RecurringMonthSlot() {
  return (
    <div aria-hidden="true" className="invisible rounded-[1.2rem] border px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-semibold">mes</p>
          <p className="text-xs">sin gastos</p>
        </div>
        <p className="font-semibold">$0</p>
      </div>
    </div>
  );
}

function formatTrendPercent(value: number) {
  const rounded = Math.round(value);

  if (!Number.isFinite(rounded)) {
    return null;
  }

  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

function RecurringMonthChart({
  months,
  selectedMonthKey,
  onSelectMonth,
}: {
  months: readonly RecurringExpenseMonthPoint[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}) {
  const maxTotal = Math.max(0, ...months.map((month) => month.total));

  return (
    <div className="flex h-40 items-end gap-1" role="group" aria-label="Últimos 12 meses">
      {months.map((month) => {
        const isSelected = month.monthKey === selectedMonthKey;
        const isZero = month.total <= 0;
        const height = !isZero && maxTotal > 0 ? Math.max((month.total / maxTotal) * 100, 8) : 0;

        return (
          <button
            key={month.monthKey}
            type="button"
            title={`${month.label}: ${formatCurrency(month.total)}`}
            aria-label={`${month.label}, ${formatCurrency(month.total)}`}
            aria-pressed={isSelected}
            onClick={() => onSelectMonth(month.monthKey)}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="flex h-32 w-full items-end">
              <span
                className={`w-full rounded-t-md ${isZero ? "h-1.5 bg-stone-400" : "bg-teal-500"} ${
                  isSelected ? "outline outline-2 outline-offset-1 outline-stone-950" : ""
                }`}
                style={isZero ? undefined : { height: `${height}%` }}
              />
            </span>
            <span className="w-full truncate text-center text-[10px] leading-none text-stone-500">
              {month.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CompareStatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedRecurringExpense, setSelectedRecurringExpense] = useState<string | null>(null);
  const [recurringQuery, setRecurringQuery] = useState("");
  const [focusedRecurringMonth, setFocusedRecurringMonth] = useState<string | null>(null);
  const [monthPage, setMonthPage] = useState(0);
  const [recurringMonthPage, setRecurringMonthPage] = useState(0);
  const [state, setState] = useState<LoadState>({
    months: [],
    activeMonth: null,
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
            error: initialPayload?.error ?? "No pudimos cargar las estadísticas.",
            isLoading: false,
          });
        }
        return;
      }

      const monthPayloads = await Promise.all(
        initialPayload.availableMonths.map(async (month) => {
          if (month.monthKey === initialPayload.currentMonth) {
            return initialPayload;
          }

          const response = await fetch(`/api/expenses?mesLiquidacion=${month.monthKey}`, {
            cache: "no-store",
          });
          const payload = await parseJson<ExpensesDashboardPayload & { error?: string }>(response);

          if (!response.ok || !payload) {
            throw new Error(payload?.error ?? "No pudimos cargar un mes histórico.");
          }

          return payload;
        })
      );

      if (!isMounted) {
        return;
      }

      const months = monthPayloads
        .map(buildMonthStats)
        .sort((firstMonth, secondMonth) => secondMonth.monthKey.localeCompare(firstMonth.monthKey));

      setSelectedMonth(initialPayload.currentMonth);
      setState({
        months,
        activeMonth: initialPayload.activeMonth,
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
        error: error instanceof Error ? error.message : "No pudimos cargar las estadísticas.",
        isLoading: false,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const newestFirstMonths = useMemo(
    () => [...state.months].sort((firstMonth, secondMonth) => secondMonth.monthKey.localeCompare(firstMonth.monthKey)),
    [state.months]
  );
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
  const maxTotal = Math.max(0, ...state.months.map((month) => month.total));
  const selectedStats =
    state.months.find((month) => month.monthKey === selectedMonth) ?? state.months[0] ?? null;
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
  const monthListSlice = useMemo(
    () => slicePage(newestFirstMonths, monthPage),
    [monthPage, newestFirstMonths]
  );
  const recurringMonthSlice = useMemo(() => {
    const newestFirst = [...(selectedRecurringStats?.months ?? [])].reverse();

    return slicePage(newestFirst, recurringMonthPage);
  }, [recurringMonthPage, selectedRecurringStats]);

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
            <div className="rounded-[1.4rem] bg-stone-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">mes pico</p>
              <p className="mt-1 text-sm font-semibold text-stone-950">
                {peakMonth ? peakMonth.label : "-"}
              </p>
              <p className="text-xs text-stone-600">
                {peakMonth ? formatCurrency(peakMonth.total) : ""}
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-teal-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">más liviano</p>
              <p className="mt-1 text-sm font-semibold text-teal-950">
                {calmMonth ? calmMonth.label : "-"}
              </p>
              <p className="text-xs text-teal-700">
                {calmMonth ? `${formatCurrency(calmMonth.averageExpense)} promedio` : ""}
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-amber-50 px-4 py-3">
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
            {state.months.length} meses
          </span>
        </div>

        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
          Página {monthListSlice.pageNumber} de {monthListSlice.totalPages}
        </p>

        <div className="mt-4 space-y-3">
          {monthListSlice.items.map((month) => {
            const newestFirstIndex = newestFirstMonths.findIndex(
              (candidate) => candidate.monthKey === month.monthKey
            );
            const previousMonth =
              newestFirstIndex >= 0 ? newestFirstMonths[newestFirstIndex + 1] ?? null : null;
            const width = maxTotal > 0 ? Math.max((month.total / maxTotal) * 100, 6) : 0;

            return (
              <button
                key={month.monthKey}
                type="button"
                onClick={() => setSelectedMonth(month.monthKey)}
                aria-pressed={selectedStats?.monthKey === month.monthKey}
                className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                  selectedStats?.monthKey === month.monthKey
                    ? "border-teal-300 bg-teal-50"
                    : "border-stone-200 bg-white/80 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-stone-950">{month.label}</p>
                    <p className={`mt-0.5 text-xs ${getDeltaTone(month.total, previousMonth?.total ?? null)}`}>
                      {formatDelta(month.total, previousMonth?.total ?? null)} vs anterior
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-stone-950">{formatCurrency(month.total)}</p>
                    <p className="text-xs text-stone-500">{month.expenseCount} gastos</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-stone-950 transition-[width]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </button>
            );
          })}
          {Array.from(
            { length: reservedRowCount(monthListSlice.items.length, newestFirstMonths.length) },
            (_, index) => (
              <ComparisonMonthSlot key={`month-slot-${index}`} />
            )
          )}
        </div>

        {newestFirstMonths.length > LIST_PAGE_SIZE ? (
          <p className="mt-3 text-xs text-stone-500">
            Mostrando {monthListSlice.items.length} de {newestFirstMonths.length} meses.
          </p>
        ) : null}

        {monthListSlice.totalPages > 1 ? (
          <ListPagination
            currentPage={monthListSlice.pageNumber}
            totalPages={monthListSlice.totalPages}
            canGoBack={monthListSlice.canGoBack}
            canGoForward={monthListSlice.canGoForward}
            onPrevious={() => setMonthPage(Math.max(monthListSlice.page - 1, 0))}
            onNext={() =>
              setMonthPage(Math.min(monthListSlice.page + 1, monthListSlice.totalPages - 1))
            }
            previousAriaLabel="Ver página anterior de meses"
            nextAriaLabel="Ver página siguiente de meses"
          />
        ) : null}
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
                            setRecurringMonthPage(0);
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
                  <RecurringMonthChart
                    months={selectedRecurringStats.months}
                    selectedMonthKey={focusedRecurringPoint.monthKey}
                    onSelectMonth={setFocusedRecurringMonth}
                  />
                  <p className="mt-2 text-center text-xs text-stone-600">
                    {focusedRecurringPoint.label} · {formatCurrency(focusedRecurringPoint.total)}
                    {focusedRecurringPoint.transactionCount > 1
                      ? ` · ${focusedRecurringPoint.transactionCount} gastos`
                      : ""}
                  </p>
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

                <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                  Página {recurringMonthSlice.pageNumber} de {recurringMonthSlice.totalPages}
                </p>

                <div className="mt-3 space-y-2">
                  {recurringMonthSlice.items.map((month) => (
                    <div
                      key={`${selectedRecurringStats.normalizedName}-${month.monthKey}`}
                      className={`rounded-[1.1rem] border px-3 py-3 ${
                        month.monthKey === focusedRecurringPoint.monthKey
                          ? "border-teal-300 bg-teal-50"
                          : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-semibold text-stone-950">{month.label}</p>
                          <p className="text-xs text-stone-500">
                            {month.transactionCount === 0
                              ? "sin gastos"
                              : month.transactionCount === 1
                                ? "1 gasto"
                                : `${month.transactionCount} gastos sumados`}
                          </p>
                        </div>
                        <p className="font-semibold text-stone-950">{formatCurrency(month.total)}</p>
                      </div>
                    </div>
                  ))}
                  {Array.from(
                    {
                      length: reservedRowCount(
                        recurringMonthSlice.items.length,
                        selectedRecurringStats.months.length
                      ),
                    },
                    (_, index) => (
                      <RecurringMonthSlot key={`recurring-month-slot-${index}`} />
                    )
                  )}
                </div>

                {selectedRecurringStats.months.length > LIST_PAGE_SIZE ? (
                  <p className="mt-3 text-xs text-stone-500">
                    Mostrando {recurringMonthSlice.items.length} de {selectedRecurringStats.months.length}{" "}
                    meses.
                  </p>
                ) : null}

                {recurringMonthSlice.totalPages > 1 ? (
                  <ListPagination
                    currentPage={recurringMonthSlice.pageNumber}
                    totalPages={recurringMonthSlice.totalPages}
                    canGoBack={recurringMonthSlice.canGoBack}
                    canGoForward={recurringMonthSlice.canGoForward}
                    onPrevious={() =>
                      setRecurringMonthPage(Math.max(recurringMonthSlice.page - 1, 0))
                    }
                    onNext={() =>
                      setRecurringMonthPage(
                        Math.min(recurringMonthSlice.page + 1, recurringMonthSlice.totalPages - 1)
                      )
                    }
                    previousAriaLabel="Ver página anterior de la evolución del gasto"
                    nextAriaLabel="Ver página siguiente de la evolución del gasto"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
