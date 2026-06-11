"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatExpenseDate, formatMonthLabel } from "@/lib/date-helpers";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseListItem, ExpensesDashboardPayload } from "@/types/expense";

type LoadState = {
  months: MonthStats[];
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
  biggestExpense: ExpenseListItem | null;
  biggestDay: {
    dateKey: string;
    label: string;
    total: number;
  } | null;
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

function buildBiggestDay(expenses: ExpenseListItem[]) {
  const totalsByDate = expenses.reduce<Map<string, number>>((accumulator, expense) => {
    const dateKey = expense.fecha.slice(0, 10);

    accumulator.set(dateKey, roundCurrencyAmount((accumulator.get(dateKey) ?? 0) + expense.monto));

    return accumulator;
  }, new Map());

  return Array.from(totalsByDate.entries()).reduce<MonthStats["biggestDay"]>(
    (currentBiggestDay, [dateKey, total]) =>
      !currentBiggestDay || total > currentBiggestDay.total
        ? {
            dateKey,
            label: formatExpenseDate(`${dateKey}T12:00:00.000Z`),
            total,
          }
        : currentBiggestDay,
    null
  );
}

function buildMonthStats(payload: ExpensesDashboardPayload): MonthStats {
  const biggestExpenses = [...payload.expenses].sort(sortExpensesByAmountDesc);
  const biggestExpense = biggestExpenses[0] ?? null;
  const topThreeTotal = roundCurrencyAmount(
    biggestExpenses.slice(0, 3).reduce((runningTotal, expense) => runningTotal + expense.monto, 0)
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
    biggestExpense,
    biggestDay: buildBiggestDay(payload.expenses),
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

export function CompareStatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    months: [],
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
      setState({ months, error: "", isLoading: false });
    }

    void loadMonths().catch((error: unknown) => {
      if (!isMounted) {
        return;
      }

      setState({
        months: [],
        error: error instanceof Error ? error.message : "No pudimos cargar las estadísticas.",
        isLoading: false,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const chronologicalMonths = useMemo(
    () => [...state.months].sort((firstMonth, secondMonth) => firstMonth.monthKey.localeCompare(secondMonth.monthKey)),
    [state.months]
  );
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

          <div className="flex flex-wrap gap-2">
            <Link
              href="/resumen"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
            >
              Resumen
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
            >
              Dashboard
            </Link>
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

        <div className="mt-4 space-y-3">
          {chronologicalMonths.map((month, index) => {
            const previousMonth = chronologicalMonths[index - 1] ?? null;
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
        </div>
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
            <div className="rounded-[1.2rem] bg-amber-50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                día más caro
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-amber-950">
                {selectedStats.biggestDay?.label ?? "-"}
              </p>
              <p className="text-xs text-amber-700">
                {selectedStats.biggestDay ? formatCurrency(selectedStats.biggestDay.total) : ""}
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-rose-50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                mayor gasto
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-rose-950">
                {selectedStats.biggestExpense?.descripcion ?? "-"}
              </p>
              <p className="text-xs text-rose-700">
                {selectedStats.biggestExpense ? formatCurrency(selectedStats.biggestExpense.monto) : ""}
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
        </section>
      ) : null}
    </div>
  );
}
