"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

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
const EXPENSE_CATEGORY_LABELS = new Map<string, string>(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label])
);

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function capitalizeMonthLabel(monthKey: string) {
  const monthLabel = formatMonthLabel(monthKey);

  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`;
}

function formatMonthName(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(date);

  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`;
}

function getMonthYear(monthKey: string) {
  return monthKey.slice(0, 4);
}

function formatPickerLabel(monthKey: string) {
  return `${formatMonthName(monthKey)} ${getMonthYear(monthKey)}`;
}

const PICKER_MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_FILTER);
  const [spendingRowsPage, setSpendingRowsPage] = useState(0);
  const finalizeNoticeRef = useRef("");
  const monthPickerRef = useRef<HTMLDivElement>(null);
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

      const finalizeNotice = finalizeNoticeRef.current;
      finalizeNoticeRef.current = "";

      setPaymentForm(buildDefaultPaymentForm(data));
      setPaymentError("");
      setPaymentFeedback("");
      setFinalizeFeedback(finalizeNotice);
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
  useEffect(() => {
    if (!isMonthPickerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMonthPickerOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const selectedButton = monthPickerRef.current?.querySelector<HTMLButtonElement>(
      "[aria-current='true']"
    );
    selectedButton?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMonthPickerOpen]);

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
    setIsMonthPickerOpen(false);
  }

  function openMonthPicker() {
    if (!state.payload) {
      return;
    }

    setPickerYear(getMonthYear(state.payload.currentMonth));
    setIsMonthPickerOpen(true);
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
      finalizeNoticeRef.current = "Mes finalizado.";
      setFinalizeFeedback("Mes finalizado.");
      setSpendingRowsPage(0);
      setPaymentsPage(0);
      setCategoriesPage(0);
      setFilteredExpensesPage(0);
      const nextActiveMonth = data?.activeMonth ?? null;

      if (nextActiveMonth === selectedMonth) {
        setReloadNonce((currentValue) => currentValue + 1);
      } else {
        setSelectedMonth(nextActiveMonth);
      }
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
  const selectedCategoryLabel = selectedCategorySummary
    ? `${selectedCategorySummary.icon} ${selectedCategorySummary.label}`
    : "Todas";
  const activeSettlement = payload.summary.activeDebt.settlement;
  const hasActiveSettlement = Boolean(activeSettlement);
  const selectedExpensesTotal =
    activeCategoryFilter === ALL_CATEGORY_FILTER
      ? payload.summary.gastoTotal
      : selectedCategorySummary?.total ?? 0;
  const monthsByKey = new Map(payload.availableMonths.map((month) => [month.monthKey, month]));
  const pickerYears: string[] = [];

  for (const month of payload.availableMonths) {
    const year = getMonthYear(month.monthKey);

    if (!pickerYears.includes(year)) {
      pickerYears.push(year);
    }
  }

  const activePickerYear =
    pickerYear && pickerYears.includes(pickerYear) ? pickerYear : getMonthYear(payload.currentMonth);
  const pickerYearIndex = pickerYears.indexOf(activePickerYear);
  const newerPickerYear = pickerYearIndex > 0 ? pickerYears[pickerYearIndex - 1] : null;
  const olderPickerYear =
    pickerYearIndex >= 0 && pickerYearIndex < pickerYears.length - 1
      ? pickerYears[pickerYearIndex + 1]
      : null;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-stone-950">
                Resumen
              </h1>
              <span
                className={`mt-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  payload.monthState.isFinalized
                    ? "bg-stone-100 text-stone-600"
                    : "bg-teal-50 text-teal-800"
                }`}
              >
                {payload.monthState.isFinalized ? "Cerrado" : "Abierto"}
              </span>
            </div>
            <button
              type="button"
              onClick={openMonthPicker}
              aria-haspopup="dialog"
              aria-expanded={isMonthPickerOpen}
              aria-label={`Cambiar mes, ${formatPickerLabel(payload.currentMonth)}`}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-left transition hover:border-stone-300 hover:bg-white active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-800 ring-1 ring-stone-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3.5v3M16 3.5v3M4 10h16" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-stone-500">Cambiar</span>
                <span className="block truncate text-base font-semibold text-stone-950">
                  {formatPickerLabel(payload.currentMonth)}
                </span>
              </span>
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-stone-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {payload.monthState.isCurrent ? null : (
              <p className="mt-1 text-xs text-stone-500">
                Mes activo: {capitalizeMonthLabel(payload.activeMonth)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void handleCopyExpenses();
              }}
              aria-label="Exportar gastos"
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white hover:text-stone-950"
            >
              Exportar
            </button>
            {payload.monthState.canFinalize ? (
              <button
                type="button"
                onClick={requestFinalizeConfirmation}
                disabled={isFinalizingMonth}
                className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFinalizingMonth ? "Finalizando..." : "Finalizar mes"}
              </button>
            ) : null}
          </div>

          {finalizeFeedback || finalizeError || exportFeedback || exportError ? (
            <div className="space-y-1 text-sm">
              {finalizeFeedback ? <p className="text-teal-800">{finalizeFeedback}</p> : null}
              {finalizeError ? <p className="text-rose-700">{finalizeError}</p> : null}
              {exportFeedback ? <p className="text-teal-800">{exportFeedback}</p> : null}
              {exportError ? <p className="text-rose-700">{exportError}</p> : null}
            </div>
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

      {isMonthPickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center"
          onClick={() => setIsMonthPickerOpen(false)}
        >
          <div
            ref={monthPickerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="month-picker-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-[0_20px_80px_rgba(28,25,23,0.32)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="month-picker-title" className="text-lg font-semibold tracking-tight text-stone-950">
                Elegir mes
              </h2>
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Año anterior"
                disabled={!olderPickerYear}
                onClick={() => {
                  if (olderPickerYear) {
                    setPickerYear(olderPickerYear);
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M12.5 5 7.5 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="text-2xl font-semibold tracking-tight text-stone-950">{activePickerYear}</p>
              <button
                type="button"
                aria-label="Año siguiente"
                disabled={!newerPickerYear}
                onClick={() => {
                  if (newerPickerYear) {
                    setPickerYear(newerPickerYear);
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M7.5 5 12.5 10l-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {PICKER_MONTH_NUMBERS.map((monthNumber) => {
                const monthKey = `${activePickerYear}-${String(monthNumber).padStart(2, "0")}`;
                const month = monthsByKey.get(monthKey);
                const isSelected = monthKey === payload.currentMonth;
                const monthName = formatMonthName(monthKey);

                return (
                  <button
                    key={monthKey}
                    type="button"
                    disabled={!month}
                    aria-current={isSelected ? "true" : undefined}
                    aria-label={
                      month?.isFinalized ? `${monthName} ${activePickerYear}, cerrado` : `${monthName} ${activePickerYear}`
                    }
                    onClick={() => handleSelectMonth(monthKey)}
                    className={`rounded-2xl px-2 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:cursor-not-allowed disabled:text-stone-300 ${
                      isSelected
                        ? "bg-stone-950 text-white"
                        : "text-stone-800 hover:bg-stone-100"
                    }`}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

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
