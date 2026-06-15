"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { formatExpenseDate, formatMonthLabel, getTodayInputValue } from "@/lib/date-helpers";
import { formatCurrency } from "@/lib/utils";
import type {
  ActiveDebtSettlement,
  ExpenseListItem,
  ExpensesDashboardPayload,
  HouseholdUserOption,
} from "@/types/expense";

type LoadState = {
  payload: ExpensesDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

type PaymentFormState = {
  fromUserId: string;
  toUserId: string;
  monto: string;
  fecha: string;
};

type FinalizeDialogState = {
  isOpen: boolean;
  message: string;
  settlement: ActiveDebtSettlement | null;
};

const ALL_CATEGORY_FILTER = "all";
const MAX_VISIBLE_MONTHS = 5;
const MAX_VISIBLE_FILTERED_EXPENSES = 5;

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function formatSignedBalance(amount: number | null) {
  if (amount === null) {
    return null;
  }

  if (Math.abs(amount) < 0.01) {
    return "Al día";
  }

  return amount > 0
    ? `${formatCurrency(amount)} a favor`
    : `${formatCurrency(Math.abs(amount))} por cubrir`;
}

function formatSummaryTitle(monthKey: string) {
  const monthLabel = formatMonthLabel(monthKey);

  return `Resumen ${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`;
}

function buildDefaultPaymentForm(payload: ExpensesDashboardPayload | null): PaymentFormState {
  const settlement = payload?.summary.activeDebt.settlement;
  const fallbackUsers = payload?.users ?? [];
  const defaultFrom = settlement?.fromUserId ?? fallbackUsers[0]?._id ?? "";
  const defaultTo = settlement?.toUserId ?? fallbackUsers.find((user) => user._id !== defaultFrom)?._id ?? "";

  return {
    fromUserId: defaultFrom,
    toUserId: defaultTo,
    monto: settlement?.amount ? `${settlement.amount}` : "",
    fecha: getTodayInputValue(),
  };
}

function findUserName(users: HouseholdUserOption[], userId: string) {
  return users.find((user) => user._id === userId)?.nombre ?? "Persona";
}

function sortExpensesByNewest(firstExpense: ExpenseListItem, secondExpense: ExpenseListItem) {
  const dateDiff =
    new Date(secondExpense.fecha).getTime() - new Date(firstExpense.fecha).getTime();

  return (
    dateDiff ||
    new Date(secondExpense.createdAt).getTime() -
      new Date(firstExpense.createdAt).getTime()
  );
}

export function StatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_FILTER);
  const [historyPage, setHistoryPage] = useState(0);
  const [filteredExpensesPage, setFilteredExpensesPage] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(buildDefaultPaymentForm(null));
  const [paymentError, setPaymentError] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [finalizeFeedback, setFinalizeFeedback] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [finalizeDialog, setFinalizeDialog] = useState<FinalizeDialogState>({
    isOpen: false,
    message: "",
    settlement: null,
  });
  const [isSubmittingPayment, startPaymentTransition] = useTransition();
  const [isFinalizingMonth, startFinalizeTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function loadExpenses() {
      const params = new URLSearchParams();

      if (selectedMonth) {
        params.set("mesLiquidacion", selectedMonth);
      }

      const response = await fetch(
        `/api/expenses${params.size > 0 ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );
      const data = await parseJson<ExpensesDashboardPayload & { error?: string }>(response);

      if (!isMounted) {
        return;
      }

      if (!response.ok || !data) {
        setState({
          payload: null,
          error: data?.error ?? "No pudimos cargar el resumen del mes.",
          isLoading: false,
        });
        return;
      }

      setPaymentForm(buildDefaultPaymentForm(data));
      setPaymentError("");
      setPaymentFeedback("");
      setFinalizeFeedback("");
      setFinalizeError("");
      setState({ payload: data, error: "", isLoading: false });
    }

    void loadExpenses();

    return () => {
      isMounted = false;
    };
  }, [reloadNonce, selectedMonth]);

  const spendingRows = useMemo(() => state.payload?.summary.spendingByUser ?? [], [state.payload]);
  const payments = useMemo(() => state.payload?.payments ?? [], [state.payload]);
  const categorySummaries = useMemo(
    () => state.payload?.summary.categorySummary ?? [],
    [state.payload]
  );
  const activeCategoryFilter =
    selectedCategory === ALL_CATEGORY_FILTER ||
    categorySummaries.some((category) => category.categoria === selectedCategory)
      ? selectedCategory
      : ALL_CATEGORY_FILTER;
  const expenseCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();

    state.payload?.expenses.forEach((expense) => {
      counts.set(expense.categoria, (counts.get(expense.categoria) ?? 0) + 1);
    });

    return counts;
  }, [state.payload]);
  const selectedCategorySummary = useMemo(
    () =>
      activeCategoryFilter === ALL_CATEGORY_FILTER
        ? null
        : categorySummaries.find((category) => category.categoria === activeCategoryFilter) ?? null,
    [activeCategoryFilter, categorySummaries]
  );
  const filteredExpenses = useMemo(() => {
    const expenses = state.payload?.expenses ?? [];
    const visibleExpenses =
      activeCategoryFilter === ALL_CATEGORY_FILTER
        ? expenses
        : expenses.filter((expense) => expense.categoria === activeCategoryFilter);

    return [...visibleExpenses].sort(sortExpensesByNewest);
  }, [activeCategoryFilter, state.payload]);
  const visibleMonths = useMemo(() => {
    const payload = state.payload;

    if (!payload) {
      return [];
    }

    const totalPages = Math.max(1, Math.ceil(payload.availableMonths.length / MAX_VISIBLE_MONTHS));
    const safeHistoryPage = Math.max(0, Math.min(historyPage, totalPages - 1));
    const startIndex = safeHistoryPage * MAX_VISIBLE_MONTHS;

    return payload.availableMonths.slice(startIndex, startIndex + MAX_VISIBLE_MONTHS);
  }, [historyPage, state.payload]);

  function openFinalizeDialog(message: string, settlement: ActiveDebtSettlement | null) {
    setFinalizeDialog({
      isOpen: true,
      message,
      settlement,
    });
  }

  function closeFinalizeDialog() {
    setFinalizeDialog({
      isOpen: false,
      message: "",
      settlement: null,
    });
  }

  function requestFinalizeConfirmation() {
    if (!state.payload) {
      return;
    }

    const settlement = state.payload.summary.activeDebt.settlement;

    openFinalizeDialog(
      settlement
        ? state.payload.summary.activeDebt.message
        : `Vas a cerrar ${formatMonthLabel(state.payload.currentMonth)} y pasar al siguiente mes.`,
      settlement
    );
  }

  function handleSelectMonth(monthKey: string) {
    setFilteredExpensesPage(0);
    setSelectedMonth(monthKey);
  }

  function handleSelectCategory(categoryKey: string) {
    setFilteredExpensesPage(0);
    setSelectedCategory(categoryKey);
  }

  async function finalizeMonth(force: boolean) {
    if (!state.payload) {
      return;
    }

    const payload = state.payload;

    setFinalizeFeedback("");
    setFinalizeError("");
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: "",
    }));

    startFinalizeTransition(async () => {
      const response = await fetch("/api/months/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          force,
          monthKey: payload.currentMonth,
        }),
      });
      const data = await parseJson<{
        error?: string;
        activeMonth?: string;
        outstandingDebt?: ActiveDebtSettlement;
        googleSheetsExport?: {
          ok: boolean;
          error?: string;
          sheetTitle?: string;
        } | null;
      }>(response);

      if (!response.ok) {
        if (response.status === 409) {
          setState((currentState) => ({
            ...currentState,
            isLoading: false,
          }));
          openFinalizeDialog(
            data?.error ?? "Todavía queda deuda pendiente en este mes.",
            data?.outstandingDebt ?? payload.summary.activeDebt.settlement
          );
          return;
        }

        setFinalizeError(data?.error ?? "No pudimos finalizar el mes.");
        setState((currentState) => ({
          ...currentState,
          isLoading: false,
        }));
        return;
      }

      closeFinalizeDialog();
      if (data?.googleSheetsExport?.ok && data.googleSheetsExport.sheetTitle) {
        setFinalizeFeedback(
          `Mes finalizado. Exportamos el cierre a Google Sheets en la hoja ${data.googleSheetsExport.sheetTitle}.`
        );
      } else if (data?.googleSheetsExport?.ok === false) {
        setFinalizeFeedback(
          data.googleSheetsExport.error ??
            "Mes finalizado, pero la exportación automática a Google Sheets falló."
        );
      } else {
        setFinalizeFeedback("Mes finalizado.");
      }
      setFilteredExpensesPage(0);
      setSelectedMonth(data?.activeMonth ?? null);
    });
  }

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!state.payload) {
      return;
    }

    const payload = state.payload;

    setPaymentError("");
    setPaymentFeedback("");
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: "",
    }));

    startPaymentTransition(async () => {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...paymentForm,
          monto: Number(paymentForm.monto),
          mesLiquidacion: payload.currentMonth,
        }),
      });
      const data = await parseJson<{ error?: string }>(response);

      if (!response.ok) {
        setPaymentError(data?.error ?? "No pudimos registrar el pago.");
        setState((currentState) => ({
          ...currentState,
          isLoading: false,
        }));
        return;
      }

      setPaymentFeedback("Pago cargado en el resumen.");
      setReloadNonce((currentValue) => currentValue + 1);
    });
  }

  if (state.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-[2rem] bg-white/70" />
        <div className="h-72 animate-pulse rounded-[2rem] bg-white/60" />
      </div>
    );
  }

  if (state.error || !state.payload) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-6 text-rose-800">
        <h1 className="text-lg font-semibold">No pudimos abrir el resumen.</h1>
        <p className="mt-2 text-sm leading-6">{state.error || "Intentá recargar la página."}</p>
      </section>
    );
  }

  const payload = state.payload;
  const viewingPastMonth = !payload.monthState.isCurrent;
  const totalHistoryPages = Math.max(1, Math.ceil(payload.availableMonths.length / MAX_VISIBLE_MONTHS));
  const safeHistoryPage = Math.max(0, Math.min(historyPage, totalHistoryPages - 1));
  const currentHistoryPage = safeHistoryPage + 1;
  const canMoveToPreviousHistoryPage = safeHistoryPage > 0;
  const canMoveToNextHistoryPage = safeHistoryPage < totalHistoryPages - 1;
  const selectedCategoryLabel = selectedCategorySummary
    ? `${selectedCategorySummary.icon} ${selectedCategorySummary.label}`
    : "Todas";
  const activeSettlement = payload.summary.activeDebt.settlement;
  const hasActiveSettlement = Boolean(activeSettlement);
  const selectedExpensesTotal =
    activeCategoryFilter === ALL_CATEGORY_FILTER
      ? payload.summary.gastoTotal
      : selectedCategorySummary?.total ?? 0;
  const totalFilteredExpensePages = Math.max(
    1,
    Math.ceil(filteredExpenses.length / MAX_VISIBLE_FILTERED_EXPENSES)
  );
  const safeFilteredExpensesPage = Math.max(
    0,
    Math.min(filteredExpensesPage, totalFilteredExpensePages - 1)
  );
  const currentFilteredExpensesPage = safeFilteredExpensesPage + 1;
  const canMoveToPreviousFilteredExpensesPage = safeFilteredExpensesPage > 0;
  const canMoveToNextFilteredExpensesPage =
    safeFilteredExpensesPage < totalFilteredExpensePages - 1;
  const paginatedFilteredExpenses = filteredExpenses.slice(
    safeFilteredExpensesPage * MAX_VISIBLE_FILTERED_EXPENSES,
    safeFilteredExpensesPage * MAX_VISIBLE_FILTERED_EXPENSES + MAX_VISIBLE_FILTERED_EXPENSES
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
            {formatSummaryTitle(payload.currentMonth)}
          </h1>

          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="rounded-full bg-teal-50 px-3 py-2 text-teal-800">
              mes activo {formatMonthLabel(payload.activeMonth)}
            </span>
            {payload.monthState.isFinalized ? (
              <span className="rounded-full bg-stone-100 px-3 py-2 text-stone-700">
                cerrado {payload.monthState.closedAt ? formatExpenseDate(payload.monthState.closedAt) : ""}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-800">
                mes abierto
              </span>
            )}
            {viewingPastMonth ? (
              <span className="rounded-full bg-stone-100 px-3 py-2 text-stone-700">
                viendo histórico
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/configuracion"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
            >
              Configuración
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
            >
              Volver
            </Link>
            <Link
              href="/estadisticas"
              className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 transition hover:border-teal-300 hover:text-teal-950"
            >
              Estadísticas
            </Link>
            {payload.monthState.canFinalize ? (
              <button
                type="button"
                onClick={requestFinalizeConfirmation}
                disabled={isFinalizingMonth}
                className="rounded-full border border-teal-300 bg-teal-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFinalizingMonth ? "Finalizando..." : "Finalizar mes"}
              </button>
            ) : null}
          </div>

          <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                Históricos
              </h2>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                Página {currentHistoryPage} de {totalHistoryPages}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {visibleMonths.map((month) => {
                const isSelected = month.monthKey === payload.currentMonth;

                return (
                  <button
                    key={month.monthKey}
                    type="button"
                    onClick={() => handleSelectMonth(month.monthKey)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      isSelected
                        ? "bg-stone-950 text-white"
                        : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:text-stone-950"
                    }`}
                  >
                    {formatMonthLabel(month.monthKey)}
                    {month.isFinalized ? " · cerrado" : month.isCurrent ? " · activo" : ""}
                  </button>
                );
              })}
            </div>

            {payload.availableMonths.length > MAX_VISIBLE_MONTHS ? (
              <p className="mt-3 text-xs text-stone-500">
                Mostrando {visibleMonths.length} de {payload.availableMonths.length} meses.
              </p>
            ) : null}

            {totalHistoryPages > 1 ? (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryPage((currentPage) => Math.max(currentPage - 1, 0))}
                  disabled={!canMoveToPreviousHistoryPage}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Ver página anterior de históricos"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((currentPage) =>
                      Math.min(currentPage + 1, totalHistoryPages - 1)
                    )
                  }
                  disabled={!canMoveToNextHistoryPage}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Ver página siguiente de históricos"
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>

          {finalizeFeedback ? (
            <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
              {finalizeFeedback}
            </p>
          ) : null}
          {finalizeError ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {finalizeError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.9rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,244,240,0.98))] p-5 text-stone-950 shadow-[0_18px_50px_rgba(28,25,23,0.12)]">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(16rem,18rem)]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Balance del mes
            </p>
            <strong className="block text-4xl font-semibold text-stone-950">
              {formatCurrency(payload.summary.gastoTotal)}
            </strong>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">gastos</p>
                <p className="mt-1 text-lg font-semibold text-stone-950">{payload.expenses.length}</p>
              </div>
              <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50/70 px-4 py-3 shadow-[0_10px_24px_rgba(13,148,136,0.06)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">pagos</p>
                <p className="mt-1 text-lg font-semibold text-teal-950">{payload.summary.paymentCount}</p>
                <p className="text-xs text-teal-800">
                  {formatCurrency(payload.summary.paymentTotal)} cargados
                </p>
              </div>
            </div>
          </div>
          <div
            className={`rounded-[1.5rem] border px-5 py-4 shadow-[0_14px_32px_rgba(28,25,23,0.08)] ${
              hasActiveSettlement
                ? "border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(254,243,199,0.92))]"
                : "border-teal-200 bg-[linear-gradient(180deg,rgba(240,253,250,1),rgba(204,251,241,0.85))]"
            }`}
          >
            <p
              className={`text-[11px] uppercase tracking-[0.2em] ${
                hasActiveSettlement ? "text-amber-700" : "text-teal-700"
              }`}
            >
              pendiente
            </p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                hasActiveSettlement ? "text-amber-950" : "text-teal-950"
              }`}
            >
              {activeSettlement
                ? formatCurrency(activeSettlement.amount)
                : "Al día"}
            </p>
            <p
              className={`mt-2 text-sm leading-6 ${
                hasActiveSettlement ? "text-amber-900" : "text-teal-900"
              }`}
            >
              {hasActiveSettlement
                ? "Todavía queda un ajuste pendiente entre personas."
                : "No hay deuda activa para este cierre."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {spendingRows.map((user) => (
            <div
              key={user._id}
              className="rounded-[1.2rem] border border-stone-200 bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{user.nombre}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                    {user.porcentajeResponsabilidad !== null
                      ? `Le toca ${user.porcentajeResponsabilidad}% del mes`
                      : "Sin distribución configurable disponible"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-950">
                    {formatCurrency(user.totalPagado)}
                  </p>
                  {user.montoObjetivo !== null ? (
                    <p className="text-xs text-stone-500">
                      objetivo {formatCurrency(user.montoObjetivo)}
                    </p>
                  ) : null}
                </div>
              </div>

              {formatSignedBalance(user.saldoNeto) ? (
                <p className="mt-2 text-xs font-medium text-teal-700">
                  {formatSignedBalance(user.saldoNeto)}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div
          className={`mt-4 rounded-[1.4rem] border px-4 py-4 ${
            hasActiveSettlement
              ? "border-amber-200 bg-amber-50"
              : "border-teal-200 bg-teal-50"
          }`}
        >
          {activeSettlement ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Transferencia sugerida
              </p>
              <p className="text-lg font-semibold leading-7 text-amber-950">
                {activeSettlement.fromNombre} le debe {formatCurrency(activeSettlement.amount)} a{" "}
                {activeSettlement.toNombre}
              </p>
              <p className="text-sm leading-6 text-amber-900">
                {payload.summary.activeDebt.message}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                Resumen equilibrado
              </p>
              <p className="text-lg font-semibold leading-7 text-teal-950">
                Nadie le debe a nadie en este mes.
              </p>
              <p className="text-sm leading-6 text-teal-900">
                {payload.summary.activeDebt.message}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-[1.3rem] border border-stone-200 bg-stone-950 px-4 py-4 text-white shadow-[0_14px_32px_rgba(28,25,23,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-300">
              Pagos del resumen
            </h2>
            <span className="text-xs text-stone-400">
              {payments.length} registrados
            </span>
          </div>

          <form onSubmit={handleCreatePayment} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm text-stone-200">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  Paga
                </span>
                <select
                  value={paymentForm.fromUserId}
                  onChange={(event) =>
                    setPaymentForm((currentValue) => ({
                      ...currentValue,
                      fromUserId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-teal-400"
                  disabled={isSubmittingPayment}
                >
                  {payload.users.map((user) => (
                    <option key={user._id} value={user._id} className="text-stone-950">
                      {user.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm text-stone-200">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  Recibe
                </span>
                <select
                  value={paymentForm.toUserId}
                  onChange={(event) =>
                    setPaymentForm((currentValue) => ({
                      ...currentValue,
                      toUserId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-teal-400"
                  disabled={isSubmittingPayment}
                >
                  {payload.users.map((user) => (
                    <option key={user._id} value={user._id} className="text-stone-950">
                      {user.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm text-stone-200">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  Monto
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={paymentForm.monto}
                  onChange={(event) =>
                    setPaymentForm((currentValue) => ({
                      ...currentValue,
                      monto: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-teal-400"
                  disabled={isSubmittingPayment}
                  required
                />
              </label>

              <label className="space-y-1.5 text-sm text-stone-200">
                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  Fecha del pago
                </span>
                <input
                  type="date"
                  value={paymentForm.fecha}
                  onChange={(event) =>
                    setPaymentForm((currentValue) => ({
                      ...currentValue,
                      fecha: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-teal-400"
                  disabled={isSubmittingPayment}
                  required
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-stone-300">
                El pago se aplica a {formatMonthLabel(payload.currentMonth)} aunque la fecha real sea otra.
              </p>

              <button
                type="submit"
                disabled={isSubmittingPayment || payload.users.length < 2}
                className="rounded-full bg-teal-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingPayment ? "Guardando..." : "Cargar pago"}
              </button>
            </div>
          </form>

          {paymentError ? (
            <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {paymentError}
            </p>
          ) : null}

          {paymentFeedback ? (
            <p className="mt-3 rounded-2xl bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
              {paymentFeedback}
            </p>
          ) : null}

          <div className="mt-4 space-y-2">
            {payments.length > 0 ? (
              payments.map((payment) => (
                <div
                  key={payment._id}
                  className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {payment.fromUser?.nombre ?? findUserName(payload.users, payment.fromUserId)} pagó a {payment.toUser?.nombre ?? findUserName(payload.users, payment.toUserId)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-stone-400">
                        {formatExpenseDate(payment.fecha)}
                      </p>
                    </div>
                    <strong className="text-sm font-semibold text-teal-300">
                      {formatCurrency(payment.monto)}
                    </strong>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-4 text-sm text-stone-300">
                Todavía no hay pagos cargados para este resumen.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">
              Categorías
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCategoryLabel} · {filteredExpenses.length} gastos
            </p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
            {formatCurrency(selectedExpensesTotal)}
          </span>
        </div>

        {categorySummaries.length > 0 ? (
          <>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => handleSelectCategory(ALL_CATEGORY_FILTER)}
                aria-pressed={activeCategoryFilter === ALL_CATEGORY_FILTER}
                className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                  activeCategoryFilter === ALL_CATEGORY_FILTER
                    ? "border-teal-300 bg-teal-50 shadow-[0_12px_28px_rgba(13,148,136,0.12)]"
                    : "border-stone-200 bg-white/80 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-stone-900">
                      Todas las categorías
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {payload.expenses.length} gastos · 100% del mes
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-stone-700">
                    {formatCurrency(payload.summary.gastoTotal)}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full w-full rounded-full bg-teal-500 transition-[width]" />
                </div>
              </button>

              {categorySummaries.map((category) => {
                const isSelected = activeCategoryFilter === category.categoria;
                const categoryExpenseCount = expenseCountByCategory.get(category.categoria) ?? 0;

                return (
                  <button
                    key={category.categoria}
                    type="button"
                    onClick={() => handleSelectCategory(category.categoria)}
                    aria-pressed={isSelected}
                    className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-teal-300 bg-teal-50 shadow-[0_12px_28px_rgba(13,148,136,0.12)]"
                        : "border-stone-200 bg-white/80 hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-stone-900">
                          {category.icon} {category.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {categoryExpenseCount} gastos · {category.percentage}% del mes
                        </span>
                      </div>
                      <span className="shrink-0 font-semibold text-stone-700">
                        {formatCurrency(category.total)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-[width]"
                        style={{
                          width: `${Math.min(Math.max(category.percentage, 6), 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                    Gastos filtrados
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Página {currentFilteredExpensesPage} de {totalFilteredExpensePages}
                  </p>
                </div>
                <span className="text-xs font-medium text-stone-500">{filteredExpenses.length}</span>
              </div>

              {filteredExpenses.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {paginatedFilteredExpenses.map((expense) => (
                    <article
                      key={expense._id}
                      className="rounded-[1.1rem] border border-white bg-white px-3 py-3 shadow-[0_8px_22px_rgba(28,25,23,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                            {formatExpenseDate(expense.fecha)} · {expense.pagadoPorDetalle?.nombre ?? findUserName(payload.users, expense.pagadoPor)}
                          </p>
                          <h4 className="mt-1 truncate text-sm font-semibold text-stone-950">
                            {expense.descripcion}
                          </h4>
                        </div>
                        <strong className="shrink-0 text-sm font-semibold text-stone-950">
                          {formatCurrency(expense.monto)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-[1.1rem] border border-dashed border-stone-300 px-4 py-5 text-sm text-stone-500">
                  Sin gastos para este filtro.
                </p>
              )}

              {filteredExpenses.length > MAX_VISIBLE_FILTERED_EXPENSES ? (
                <>
                  <p className="mt-3 text-xs text-stone-500">
                    Mostrando {paginatedFilteredExpenses.length} de {filteredExpenses.length} gastos.
                  </p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFilteredExpensesPage((currentPage) => Math.max(currentPage - 1, 0))
                      }
                      disabled={!canMoveToPreviousFilteredExpensesPage}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Ver página anterior de gastos filtrados"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFilteredExpensesPage((currentPage) =>
                          Math.min(currentPage + 1, totalFilteredExpensePages - 1)
                        )
                      }
                      disabled={!canMoveToNextFilteredExpensesPage}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Ver página siguiente de gastos filtrados"
                    >
                      Siguiente
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-stone-600">Sin categorías registradas.</p>
        )}
      </section>

      {finalizeDialog.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-[0_20px_80px_rgba(28,25,23,0.32)]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Confirmar cierre
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
                ¿Querés finalizar el mes?
              </h2>
              <p className="text-sm leading-6 text-stone-700">
                {finalizeDialog.message}
              </p>
              {finalizeDialog.settlement ? (
                <div className="rounded-[1.4rem] bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  {finalizeDialog.settlement.fromNombre} todavía le debe {formatCurrency(finalizeDialog.settlement.amount)} a {finalizeDialog.settlement.toNombre}.
                </div>
              ) : (
                <div className="rounded-[1.4rem] bg-stone-100 px-4 py-4 text-sm text-stone-700">
                  Si confirmás, el mes actual se cierra y la app va a abrir el siguiente período para seguir cargando movimientos.
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeFinalizeDialog}
                className="flex-1 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
              >
                Seguir en este mes
              </button>
              <button
                type="button"
                onClick={() => {
                  void finalizeMonth(Boolean(finalizeDialog.settlement));
                }}
                disabled={isFinalizingMonth}
                className="flex-1 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFinalizingMonth ? "Cerrando..." : "Sí, finalizar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
