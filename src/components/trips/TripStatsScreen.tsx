"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { formatExpenseDate } from "@/lib/date-helpers";
import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import type { TripDashboardPayload } from "@/types/trip";

type LoadState = {
  payload: TripDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

const ALL_CATEGORY_FILTER = "__all__";

function formatSignedBalance(amount: number) {
  if (Math.abs(amount) < 0.01) return "";
  return `${amount > 0 ? "+" : ""}${formatCurrency(amount)}`;
}

export function TripStatsScreen() {
  const params = useParams();
  const tripId = params.tripId as string;
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
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

  const settlement = useMemo(() => {
    if (!payload || payload.users.length !== 2) return null;

    const [userA, userB] = payload.users;
    const balanceA = payload.summary.balancePorUsuario[userA._id] ?? 0;
    const balanceB = payload.summary.balancePorUsuario[userB._id] ?? 0;

    if (balanceA < -0.01) {
      return { fromNombre: userA.nombre, toNombre: userB.nombre, amount: Math.abs(balanceA) };
    }

    if (balanceB < -0.01) {
      return { fromNombre: userB.nombre, toNombre: userA.nombre, amount: Math.abs(balanceB) };
    }

    return null;
  }, [payload]);

  const filteredExpenses = useMemo(() => {
    if (!payload) return [];
    if (activeCategoryFilter === ALL_CATEGORY_FILTER) return payload.expenses;

    return payload.expenses.filter((exp) => exp.categoria === activeCategoryFilter);
  }, [payload, activeCategoryFilter]);

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

  const hasActiveSettlement = Boolean(settlement);
  const selectedCategoryLabel =
    activeCategoryFilter === ALL_CATEGORY_FILTER
      ? "Todas las categorías"
      : TRIP_EXPENSE_CATEGORIES.find((cat) => cat.value === activeCategoryFilter)?.label ??
        "Categoría";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <Link
        href={`/viajes/${tripId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        ← Volver a {payload.trip.nombre}
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-stone-950">Estadísticas</h1>
        <p className="mt-2 text-sm text-stone-600">Análisis de gastos del viaje</p>
      </div>

      <section className="overflow-hidden rounded-[1.9rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,244,240,0.98))] p-5 text-stone-950 shadow-[0_18px_50px_rgba(28,25,23,0.12)]">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),minmax(16rem,18rem)]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Gasto total del viaje
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
                <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">ciudades</p>
                <p className="mt-1 text-lg font-semibold text-teal-950">{expensesByCity.length}</p>
              </div>
            </div>
          </div>

          {payload.users.length === 2 && (
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
                {settlement ? formatCurrency(settlement.amount) : "Al día"}
              </p>
              <p
                className={`mt-2 text-sm leading-6 ${
                  hasActiveSettlement ? "text-amber-900" : "text-teal-900"
                }`}
              >
                {settlement
                  ? `${settlement.fromNombre} le debe a ${settlement.toNombre}.`
                  : "Nadie le debe a nadie en este viaje."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            Personas
          </p>

          <div className="mt-3 grid gap-2">
            {payload.users.map((user) => {
              const totalPaid =
                payload.summary.totalesPorUsuario.find((t) => t.userId === user._id)
                  ?.totalPagado ?? 0;
              const balance = payload.summary.balancePorUsuario[user._id] ?? 0;
              const signedBalance = formatSignedBalance(balance);

              return (
                <div
                  key={user._id}
                  className="rounded-[1.2rem] border border-stone-200 bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-950">{user.nombre}</p>
                    <p className="text-sm font-semibold text-stone-950">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>
                  {signedBalance ? (
                    <p className="mt-2 text-xs font-medium text-teal-700">{signedBalance}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

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
                    {formatCurrency(city.total)} · {city.percentage}%
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
                    {formatCurrency(payload.summary.gastoTotal)}
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
                        {formatCurrency(cat.total)}
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
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-stone-600">Sin categorías registradas.</p>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Detalles</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Cantidad de gastos</span>
            <span className="font-semibold text-stone-950">{payload.expenses.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Gasto promedio</span>
            <span className="font-semibold text-stone-950">
              {formatCurrency(
                payload.expenses.length > 0
                  ? payload.summary.gastoTotal / payload.expenses.length
                  : 0
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Mayor gasto</span>
            <span className="font-semibold text-stone-950">
              {formatCurrency(Math.max(...payload.expenses.map((e) => e.monto), 0))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
