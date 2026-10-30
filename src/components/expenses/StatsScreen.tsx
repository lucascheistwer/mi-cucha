"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { ListPagination } from "@/components/shared/ListPagination";
import {
  BalanceOverview,
  CategoryBreakdown,
  DebtSettlementCard,
  PaymentsPanel,
  PersonBalanceList,
  SummaryPanel,
} from "@/components/shared/SummaryShells";
import { formatSignedBalance } from "@/lib/balance-format";
import { formatExpenseDate, formatMonthLabel, getTodayInputValue } from "@/lib/date-helpers";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { LIST_PAGE_SIZE, slicePage } from "@/lib/list-pagination";
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
const MAX_VISIBLE_MONTHS = LIST_PAGE_SIZE;
const EXPENSE_CATEGORY_LABELS = new Map<string, string>(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label])
);

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
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

function sanitizeClipboardCell(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatClipboardDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = date.getUTCDate();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

function formatClipboardCurrency(value: number) {
  const roundedValue = Number.isInteger(value) ? value : Number(value.toFixed(2));

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(roundedValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(roundedValue);
}

function buildExpensesClipboardText(expenses: ExpenseListItem[]) {
  return [...expenses]
    .sort((firstExpense, secondExpense) => {
      const dateDiff =
        new Date(firstExpense.fecha).getTime() - new Date(secondExpense.fecha).getTime();

      return (
        dateDiff ||
        new Date(firstExpense.createdAt).getTime() -
          new Date(secondExpense.createdAt).getTime()
      );
    })
    .map((expense) =>
      [
        sanitizeClipboardCell(expense.descripcion),
        EXPENSE_CATEGORY_LABELS.get(expense.categoria) ?? sanitizeClipboardCell(expense.categoria),
        formatClipboardDate(expense.fecha),
        formatClipboardCurrency(expense.monto),
        sanitizeClipboardCell(expense.pagadoPorDetalle?.nombre ?? "Persona"),
      ].join("\t")
    )
    .join("\n");
}

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export function StatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_FILTER);
  const [historyPage, setHistoryPage] = useState(0);
  const [spendingRowsPage, setSpendingRowsPage] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(0);
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
  const [exportFeedback, setExportFeedback] = useState("");
  const [exportError, setExportError] = useState("");
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
      setExportFeedback("");
      setExportError("");
      setSpendingRowsPage(0);
      setPaymentsPage(0);
      setCategoriesPage(0);
      setFilteredExpensesPage(0);
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

    return slicePage(payload.availableMonths, historyPage, MAX_VISIBLE_MONTHS).items;
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
    setSpendingRowsPage(0);
    setPaymentsPage(0);
    setCategoriesPage(0);
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
      setFinalizeFeedback("Mes finalizado.");
      setSpendingRowsPage(0);
      setPaymentsPage(0);
      setCategoriesPage(0);
      setFilteredExpensesPage(0);
      setSelectedMonth(data?.activeMonth ?? null);
    });
  }

  async function handleCopyExpenses() {
    const expenses = state.payload?.expenses ?? [];

    setExportFeedback("");
    setExportError("");

    if (expenses.length === 0) {
      setExportError("No hay gastos para copiar en este mes.");
      return;
    }

    try {
      const didCopy = await copyTextToClipboard(buildExpensesClipboardText(expenses));

      if (!didCopy) {
        throw new Error("Clipboard copy failed.");
      }

      setExportFeedback(
        `Copiamos ${expenses.length} ${expenses.length === 1 ? "gasto" : "gastos"} al portapapeles. Ya podés pegarlos en tu planilla.`
      );
    } catch {
      setExportError("No pudimos copiar los gastos al portapapeles.");
    }
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
      setPaymentsPage(0);
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
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void handleCopyExpenses();
              }}
              className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
            >
              Exportar gastos
            </button>
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
              <ListPagination
                currentPage={currentHistoryPage}
                totalPages={totalHistoryPages}
                canGoBack={canMoveToPreviousHistoryPage}
                canGoForward={canMoveToNextHistoryPage}
                onPrevious={() => setHistoryPage((currentPage) => Math.max(currentPage - 1, 0))}
                onNext={() =>
                  setHistoryPage((currentPage) =>
                    Math.min(currentPage + 1, totalHistoryPages - 1)
                  )
                }
                previousAriaLabel="Ver página anterior de históricos"
                nextAriaLabel="Ver página siguiente de históricos"
              />
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
          {exportFeedback ? (
            <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
              {exportFeedback}
            </p>
          ) : null}
          {exportError ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {exportError}
            </p>
          ) : null}
        </div>
      </section>

      <SummaryPanel>
        <BalanceOverview
          eyebrow="Balance del mes"
          total={formatCurrency(payload.summary.gastoTotal)}
          primaryStat={{ label: "gastos", value: payload.expenses.length }}
          secondaryStat={{
            label: "pagos",
            value: payload.summary.paymentCount,
            detail: `${formatCurrency(payload.summary.paymentTotal)} cargados`,
          }}
          pending={{
            hasPending: hasActiveSettlement,
            value: activeSettlement ? formatCurrency(activeSettlement.amount) : "Al día",
            detail: hasActiveSettlement
              ? "Todavía queda un ajuste pendiente entre personas."
              : "No hay deuda activa para este cierre.",
          }}
        />

        <PersonBalanceList
          people={spendingRows.map((user) => ({
            id: user._id,
            name: user.nombre,
            responsibilityLabel:
              user.porcentajeResponsabilidad !== null
                ? `Le toca ${user.porcentajeResponsabilidad}% del mes`
                : "Sin distribución configurable disponible",
            paidLabel: formatCurrency(user.totalPagado),
            targetLabel:
              user.montoObjetivo !== null ? `objetivo ${formatCurrency(user.montoObjetivo)}` : null,
            balanceLabel: formatSignedBalance(user.saldoNeto),
          }))}
          page={spendingRowsPage}
          onPageChange={setSpendingRowsPage}
        />

        <DebtSettlementCard
          hasSettlement={hasActiveSettlement}
          settlement={
            activeSettlement
              ? {
                  fromNombre: activeSettlement.fromNombre,
                  toNombre: activeSettlement.toNombre,
                  amountLabel: formatCurrency(activeSettlement.amount),
                }
              : null
          }
          message={payload.summary.activeDebt.message}
          settledHeadline="Nadie le debe a nadie en este mes."
        />

        <PaymentsPanel
          title="Pagos del resumen"
          registeredCount={payments.length}
          page={paymentsPage}
          onPageChange={setPaymentsPage}
          rows={payments.map((payment) => ({
            id: payment._id,
            title: `${payment.fromUser?.nombre ?? findUserName(payload.users, payment.fromUserId)} pagó a ${payment.toUser?.nombre ?? findUserName(payload.users, payment.toUserId)}`,
            meta: formatExpenseDate(payment.fecha),
            amount: formatCurrency(payment.monto),
          }))}
          emptyMessage="Todavía no hay pagos cargados para este resumen."
        >
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

              <label className="min-w-0 space-y-1.5 text-sm text-stone-200">
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
                  className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-teal-400"
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
        </PaymentsPanel>
      </SummaryPanel>

      <CategoryBreakdown
        scopeLabel="del mes"
        totalCount={payload.expenses.length}
        totalAmount={payload.summary.gastoTotal}
        categories={categorySummaries.map((category) => ({
          key: category.categoria,
          icon: category.icon,
          label: category.label,
          total: category.total,
          percentage: category.percentage,
          count: expenseCountByCategory.get(category.categoria) ?? 0,
        }))}
        selectedKey={activeCategoryFilter}
        allKey={ALL_CATEGORY_FILTER}
        selectedLabel={selectedCategoryLabel}
        selectedTotal={selectedExpensesTotal}
        filteredExpenses={filteredExpenses.map((expense) => ({
          id: expense._id,
          meta: `${formatExpenseDate(expense.fecha)} · ${expense.pagadoPorDetalle?.nombre ?? findUserName(payload.users, expense.pagadoPor)}`,
          title: expense.descripcion,
          amount: expense.monto,
        }))}
        onSelect={handleSelectCategory}
        categoryPage={categoriesPage}
        onCategoryPageChange={setCategoriesPage}
        filteredPage={filteredExpensesPage}
        onFilteredPageChange={setFilteredExpensesPage}
      />

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
