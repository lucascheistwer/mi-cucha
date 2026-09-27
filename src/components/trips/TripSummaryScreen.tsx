"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { formatExpenseDate, getTodayInputValue } from "@/lib/date-helpers";
import { buildTripSummary } from "@/lib/trip-summary";
import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { TripSubNav } from "@/components/trips/TripSubNav";
import type { TripDashboardPayload, TripPaymentListItem } from "@/types/trip";

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

const ALL_CATEGORY_FILTER = "__all__";

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
        ...cat,
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

    return payload.trip.ciudades
      .map((city) => {
        const total = payload.expenses
          .filter((exp) => exp.ciudad === city)
          .reduce((sum, exp) => sum + exp.monto, 0);
        return {
          nombre: city,
          total,
          percentage:
            payload.summary.gastoTotal > 0
              ? Math.round((total / payload.summary.gastoTotal) * 100)
              : 0,
        };
      })
      .filter((city) => city.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [payload]);

  const filteredExpenses = useMemo(() => {
    if (!payload) return [];
    if (activeCategoryFilter === ALL_CATEGORY_FILTER) return payload.expenses;

    return payload.expenses.filter((exp) => exp.categoria === activeCategoryFilter);
  }, [payload, activeCategoryFilter]);

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

        setPaymentFeedback("Pago cargado en el viaje.");
        setPaymentForm((currentForm) => ({ ...currentForm, monto: "" }));
      } catch {
        setPaymentError("Error al registrar el pago.");
      }
    });
  }

  if (state.isLoading) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  if (state.error || !payload) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">
          {state.error || "Error al cargar el viaje"}
        </div>
      </div>
    );
  }

  const selectedCategoryLabel =
    activeCategoryFilter === ALL_CATEGORY_FILTER
      ? "Todas las categorías"
      : TRIP_EXPENSE_CATEGORIES.find((cat) => cat.value === activeCategoryFilter)?.label ??
        "Categoría";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <Link
        href="/viajes"
        className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        ← Volver a viajes
      </Link>

      <TripSubNav tripId={tripId} />

      <div>
        <h1 className="text-3xl font-bold text-stone-950">Resumen</h1>
        <p className="mt-1 text-sm text-stone-600">{payload.trip.nombre}</p>
      </div>

      <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Gasto Total
        </h2>
        <p className="text-3xl font-bold text-stone-950">
          {formatCurrency(payload.summary.gastoTotal, "USD")}
        </p>
        <div className="mt-3 space-y-1.5">
          {payload.users.map((user) => {
            const totalPaid =
              payload.summary.totalesPorUsuario.find(
                (t) => t.userId === user._id
              )?.totalPagado || 0;
            const balance = payload.summary.balancePorUsuario[user._id] || 0;

            return (
              <div
                key={user._id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-stone-600">
                  {user.nombre} pagó {formatCurrency(totalPaid, "USD")}
                </span>
                <span
                  className={`font-semibold ${
                    balance > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {balance > 0 ? "+" : ""}{formatCurrency(balance, "USD")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.3rem] border border-stone-200 bg-stone-950 px-4 py-4 text-white shadow-[0_14px_32px_rgba(28,25,23,0.12)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-300">
            Pagos del viaje
          </h2>
          <p className="text-xs text-stone-400">
            {payload.payments.length} registrados
          </p>
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
          {payload.payments.length > 0 ? (
            payload.payments.map((payment) => (
              <div
                key={payment._id}
                className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {payment.fromUser?.nombre ?? "Persona"} pagó a{" "}
                      {payment.toUser?.nombre ?? "Persona"}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-stone-400">
                      {formatExpenseDate(payment.fecha)}
                    </p>
                  </div>
                  <strong className="text-sm font-semibold text-teal-300">
                    {formatCurrency(payment.monto, "USD")}
                  </strong>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-[1.2rem] border border-dashed border-white/10 px-4 py-4 text-sm text-stone-300">
              Todavía no hay pagos cargados para este viaje.
            </p>
          )}
        </div>
      </div>

      {expensesByCity.length > 0 && (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
          <h2 className="text-xl font-semibold tracking-tight text-stone-950">Por Ciudad</h2>
          <div className="mt-4 space-y-3">
            {expensesByCity.map((city) => (
              <div
                key={city.nombre}
                className="rounded-[1.3rem] border border-stone-200 bg-white/80 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="font-semibold text-stone-900">📍 {city.nombre}</span>
                  <span className="shrink-0 font-semibold text-stone-700">
                    {formatCurrency(city.total, "USD")} · {city.percentage}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-[width]"
                    style={{ width: `${Math.min(Math.max(city.percentage, 6), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-stone-950">Categorías</h2>
            <p className="mt-1 text-sm text-stone-500">
              {selectedCategoryLabel} · {filteredExpenses.length} gastos
            </p>
          </div>
        </div>

        {expensesByCategory.length > 0 ? (
          <>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter(ALL_CATEGORY_FILTER)}
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
                      {payload.expenses.length} gastos · 100% del viaje
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-stone-700">
                    {formatCurrency(payload.summary.gastoTotal, "USD")}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full w-full rounded-full bg-teal-500 transition-[width]" />
                </div>
              </button>

              {expensesByCategory.map((cat) => {
                const isSelected = activeCategoryFilter === cat.value;

                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setActiveCategoryFilter(cat.value)}
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
                          {cat.icon} {cat.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          {cat.count} gastos · {cat.percentage}% del viaje
                        </span>
                      </div>
                      <span className="shrink-0 font-semibold text-stone-700">
                        {formatCurrency(cat.total, "USD")}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-[width]"
                        style={{ width: `${Math.min(Math.max(cat.percentage, 6), 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Gastos filtrados
                </h3>
                <span className="text-xs font-medium text-stone-500">{filteredExpenses.length}</span>
              </div>

              {filteredExpenses.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {filteredExpenses.map((expense) => (
                    <article
                      key={expense._id}
                      className="rounded-[1.1rem] border border-white bg-white px-3 py-3 shadow-[0_8px_22px_rgba(28,25,23,0.06)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                            {formatExpenseDate(expense.fecha)} · 📍 {expense.ciudad}
                          </p>
                          <h4 className="mt-1 truncate text-sm font-semibold text-stone-950">
                            {expense.descripcion}
                          </h4>
                        </div>
                        <strong className="shrink-0 text-sm font-semibold text-stone-950">
                          {formatCurrency(expense.monto, "USD")}
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
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-stone-600">Sin categorías registradas.</p>
        )}
      </section>
    </div>
  );
}
