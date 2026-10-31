"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

import {
  BalanceOverview,
  CategoryBreakdown,
  DebtSettlementCard,
  MeterList,
  PaymentsPanel,
  PersonBalanceList,
  SummaryPanel,
} from "@/components/shared/SummaryShells";
import { TripManageBar } from "@/components/trips/TripManageBar";
import { TripSubNav } from "@/components/trips/TripSubNav";
import { formatSignedBalance } from "@/lib/balance-format";
import { formatExpenseDate, getTodayInputValue } from "@/lib/date-helpers";
import { buildTripSummary } from "@/lib/trip-summary";
import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { formatCurrency } from "@/lib/utils";
import type {
  TripDashboardPayload,
  TripDetail,
  TripExpenseListItem,
  TripPaymentListItem,
} from "@/types/trip";

type LoadState = {
  payload: TripDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

type TripPaymentFormState = {
  fromUserId: string;
  toUserId: string;
  monto: string;
  fecha: string;
};

const ALL_CATEGORY_FILTER = "all";

function buildDefaultTripPaymentForm(payload: TripDashboardPayload | null): TripPaymentFormState {
  const settlement = payload?.summary.activeDebt.settlement;
  const fallbackUsers = payload?.users ?? [];
  const defaultFrom = settlement?.fromUserId ?? fallbackUsers[0]?._id ?? "";
  const defaultTo =
    settlement?.toUserId ?? fallbackUsers.find((user) => user._id !== defaultFrom)?._id ?? "";

  return {
    fromUserId: defaultFrom,
    toUserId: defaultTo,
    monto: settlement?.amount ? `${settlement.amount}` : "",
    fecha: getTodayInputValue(),
  };
}

function sortExpensesByNewest(firstExpense: TripExpenseListItem, secondExpense: TripExpenseListItem) {
  const dateDiff = new Date(secondExpense.fecha).getTime() - new Date(firstExpense.fecha).getTime();

  return dateDiff || new Date(secondExpense.createdAt).getTime() - new Date(firstExpense.createdAt).getTime();
}

export function TripSummaryScreen() {
  const params = useParams();
  const tripId = params.tripId as string;
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
  const [paymentForm, setPaymentForm] = useState<TripPaymentFormState>(
    buildDefaultTripPaymentForm(null)
  );
  const [paymentError, setPaymentError] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [isSubmittingPayment, startPaymentTransition] = useTransition();
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>(ALL_CATEGORY_FILTER);
  const [peoplePage, setPeoplePage] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(0);
  const [categoriesPage, setCategoriesPage] = useState(0);
  const [filteredExpensesPage, setFilteredExpensesPage] = useState(0);
  const [citiesPage, setCitiesPage] = useState(0);
  const [seenTripId, setSeenTripId] = useState(tripId);

  if (seenTripId !== tripId) {
    setSeenTripId(tripId);
    setPeoplePage(0);
    setPaymentsPage(0);
    setCategoriesPage(0);
    setFilteredExpensesPage(0);
    setCitiesPage(0);
    setActiveCategoryFilter(ALL_CATEGORY_FILTER);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadTrip() {
      try {
        const response = await fetch(`/api/trips/${tripId}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as
          | TripDashboardPayload
          | { error?: string }
          | null;

        if (!isMounted) return;

        if (!response.ok || !data || !("trip" in data)) {
          setState({
            payload: null,
            error:
              (data && "error" in data ? data.error : null) ||
              "No pudimos cargar el viaje.",
            isLoading: false,
          });
          return;
        }

        setPaymentForm(buildDefaultTripPaymentForm(data));
        setPaymentError("");
        setPaymentFeedback("");
        setState({ payload: data, error: "", isLoading: false });
      } catch {
        if (isMounted) {
          setState({
            payload: null,
            error: "Error al cargar el viaje.",
            isLoading: false,
          });
        }
      }
    }

    void loadTrip();

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  const payload = state.payload;

  const expensesByCategory = useMemo(() => {
    if (!payload) return [];

    return TRIP_EXPENSE_CATEGORIES.map((cat) => {
      const total = payload.expenses
        .filter((exp) => exp.categoria === cat.value)
        .reduce((sum, exp) => sum + exp.monto, 0);
      return {
        key: cat.value,
        icon: cat.icon,
        label: cat.label,
        total,
        count: payload.expenses.filter((exp) => exp.categoria === cat.value).length,
        percentage:
          payload.summary.gastoTotal > 0
            ? Math.round((total / payload.summary.gastoTotal) * 100)
            : 0,
      };
    }).filter((cat) => cat.total > 0);
  }, [payload]);

  const expensesByCity = useMemo(() => {
    if (!payload) return [];

    const cityNames = [...payload.trip.ciudades];

    for (const expense of payload.expenses) {
      if (!cityNames.includes(expense.ciudad)) {
        cityNames.push(expense.ciudad);
      }
    }

    return cityNames
      .map((city) => {
        const total = payload.expenses
          .filter((exp) => exp.ciudad === city)
          .reduce((sum, exp) => sum + exp.monto, 0);
        return {
          id: city,
          label: `📍 ${city}`,
          total,
          percentage:
            payload.summary.gastoTotal > 0
              ? Math.round((total / payload.summary.gastoTotal) * 100)
              : 0,
        };
      })
      .filter((city) => city.total > 0)
      .sort((firstCity, secondCity) => secondCity.total - firstCity.total);
  }, [payload]);

  const filteredExpenses = useMemo(() => {
    if (!payload) return [];

    const visibleExpenses =
      activeCategoryFilter === ALL_CATEGORY_FILTER
        ? payload.expenses
        : payload.expenses.filter((exp) => exp.categoria === activeCategoryFilter);

    return [...visibleExpenses].sort(sortExpensesByNewest);
  }, [payload, activeCategoryFilter]);

  const selectedCategory = expensesByCategory.find((category) => category.key === activeCategoryFilter);
  const selectedCategoryLabel = selectedCategory
    ? `${selectedCategory.icon} ${selectedCategory.label}`
    : "Todas";
  const selectedExpensesTotal =
    activeCategoryFilter === ALL_CATEGORY_FILTER
      ? payload?.summary.gastoTotal ?? 0
      : selectedCategory?.total ?? 0;

  function handleSelectCategory(categoryKey: string) {
    setFilteredExpensesPage(0);
    setActiveCategoryFilter(categoryKey);
  }

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPaymentError("");
    setPaymentFeedback("");

    startPaymentTransition(async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/payments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...paymentForm,
            monto: Number(paymentForm.monto),
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | { payment?: TripPaymentListItem }
          | { error?: string }
          | null;

        if (!response.ok || !data || !("payment" in data) || !data.payment) {
          setPaymentError(
            (data && "error" in data ? data.error : null) ||
              "No pudimos registrar el pago."
          );
          return;
        }

        const newPayment = data.payment;

        setState((currentState) => {
          if (!currentState.payload) {
            return currentState;
          }

          const payments = [newPayment, ...currentState.payload.payments];
          const summary = buildTripSummary({
            users: currentState.payload.users,
            expenses: currentState.payload.expenses,
            payments,
            percentages: currentState.payload.porcentajesDefecto || {
              user1: 50,
              user2: 50,
            },
          });

          return {
            ...currentState,
            payload: {
              ...currentState.payload,
              payments,
              summary,
            },
          };
        });

        setPaymentsPage(0);
        setPaymentFeedback("Pago cargado en el viaje.");
        setPaymentForm((currentForm) => ({ ...currentForm, monto: "" }));
      } catch {
        setPaymentError("Error al registrar el pago.");
      }
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

  if (state.error || !payload) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-6 text-rose-800">
        <h1 className="text-lg font-semibold">No pudimos abrir el resumen.</h1>
        <p className="mt-2 text-sm leading-6">{state.error || "Intentá recargar la página."}</p>
      </section>
    );
  }

  const activeSettlement = payload.summary.activeDebt.settlement;
  const isFinalized = payload.trip.estado === "finalizado";

  function handleTripUpdated(trip: TripDetail) {
    setState((currentState) => {
      if (!currentState.payload) {
        return currentState;
      }

      return {
        ...currentState,
        payload: {
          ...currentState.payload,
          trip: {
            ...currentState.payload.trip,
            ...trip,
          },
        },
      };
    });
    setPaymentError("");
    setPaymentFeedback("");
  }
  const hasActiveSettlement = Boolean(activeSettlement);
  const percentages = payload.summary.activeDebt.percentages;
  const people = payload.users.map((user, index) => {
    const totalPagado =
      payload.summary.totalesPorUsuario.find((item) => item.userId === user._id)?.totalPagado ?? 0;
    const percentage = percentages ? (index === 0 ? percentages.user1 : percentages.user2) : null;
    const target =
      percentage === null ? null : Math.round((payload.summary.gastoTotal * percentage) / 100);

    return {
      id: user._id,
      name: user.nombre,
      responsibilityLabel:
        percentage !== null
          ? `Le toca ${percentage}% del viaje`
          : "Sin distribución configurable disponible",
      paidLabel: formatCurrency(totalPagado, "USD"),
      targetLabel: target !== null ? `objetivo ${formatCurrency(target, "USD")}` : null,
      balanceLabel: formatSignedBalance(
        percentages ? payload.summary.balancePorUsuario[user._id] ?? 0 : null,
        "USD"
      ),
    };
  });

  return (
    <div className="space-y-4">
      <Link
        href="/viajes"
        className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        ← Volver a viajes
      </Link>

      <TripSubNav tripId={tripId} />

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Resumen del viaje</h1>
          <p className="text-sm text-stone-600">{payload.trip.nombre}</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <span className="rounded-full bg-teal-50 px-3 py-2 text-teal-800">
              {payload.trip.estado === "activo" ? "viaje activo" : "viaje finalizado"}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-2 text-stone-700">
              {payload.trip.fechaInicio} – {payload.trip.fechaFin}
            </span>
          </div>
          <TripManageBar
            trip={payload.trip}
            outstandingDebt={activeSettlement}
            onUpdated={handleTripUpdated}
          />
        </div>
      </section>

      <SummaryPanel>
        <BalanceOverview
          eyebrow="Balance del viaje"
          total={formatCurrency(payload.summary.gastoTotal, "USD")}
          primaryStat={{ label: "gastos", value: payload.expenses.length }}
          secondaryStat={{
            label: "pagos",
            value: payload.summary.paymentCount,
            detail: `${formatCurrency(payload.summary.paymentTotal, "USD")} cargados`,
          }}
          pending={{
            hasPending: hasActiveSettlement,
            value: activeSettlement ? formatCurrency(activeSettlement.amount, "USD") : "Al día",
            detail: hasActiveSettlement
              ? "Todavía queda un ajuste pendiente entre personas."
              : "No hay deuda activa para este viaje.",
          }}
        />

        <PersonBalanceList people={people} page={peoplePage} onPageChange={setPeoplePage} />

        <DebtSettlementCard
          hasSettlement={hasActiveSettlement}
          settlement={
            activeSettlement
              ? {
                  fromNombre: activeSettlement.fromNombre,
                  toNombre: activeSettlement.toNombre,
                  amountLabel: formatCurrency(activeSettlement.amount, "USD"),
                }
              : null
          }
          message={payload.summary.activeDebt.message}
          settledHeadline="Nadie le debe a nadie en este viaje."
        />

        <PaymentsPanel
          title="Pagos del viaje"
          registeredCount={payload.payments.length}
          page={paymentsPage}
          onPageChange={setPaymentsPage}
          rows={payload.payments.map((payment) => ({
            id: payment._id,
            title: `${payment.fromUser?.nombre ?? "Persona"} pagó a ${payment.toUser?.nombre ?? "Persona"}`,
            meta: formatExpenseDate(payment.fecha),
            amount: formatCurrency(payment.monto, "USD"),
          }))}
          emptyMessage="Todavía no hay pagos cargados para este viaje."
        >
          {isFinalized ? (
            <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-stone-200">
              Este viaje está finalizado. No se pueden cargar pagos.
            </p>
          ) : (
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
                  Monto (USD)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
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

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmittingPayment || payload.users.length < 2}
                className="rounded-full bg-teal-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingPayment ? "Guardando..." : "Cargar pago"}
              </button>
            </div>
          </form>
          )}

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

      <MeterList
        title="Por Ciudad"
        items={expensesByCity.map((city) => ({
          id: city.id,
          label: city.label,
          amountLabel: formatCurrency(city.total, "USD"),
          percentage: city.percentage,
        }))}
        page={citiesPage}
        onPageChange={setCitiesPage}
      />

      <CategoryBreakdown
        currency="USD"
        scopeLabel="del viaje"
        totalCount={payload.expenses.length}
        totalAmount={payload.summary.gastoTotal}
        categories={expensesByCategory}
        selectedKey={activeCategoryFilter}
        allKey={ALL_CATEGORY_FILTER}
        selectedLabel={selectedCategoryLabel}
        selectedTotal={selectedExpensesTotal}
        filteredExpenses={filteredExpenses.map((expense) => ({
          id: expense._id,
          meta: `${formatExpenseDate(expense.fecha)} · 📍 ${expense.ciudad}`,
          title: expense.descripcion,
          amount: expense.monto,
        }))}
        onSelect={handleSelectCategory}
        categoryPage={categoriesPage}
        onCategoryPageChange={setCategoriesPage}
        filteredPage={filteredExpensesPage}
        onFilteredPageChange={setFilteredExpensesPage}
      />
    </div>
  );
}
