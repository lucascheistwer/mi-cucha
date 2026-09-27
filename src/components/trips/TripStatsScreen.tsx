"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { TripSubNav } from "@/components/trips/TripSubNav";
import type { TripDashboardPayload } from "@/types/trip";

type LoadState = {
  payload: TripDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

export function TripStatsScreen() {
  const params = useParams();
  const tripId = params.tripId as string;
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });

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

  const citiesWithExpenses = useMemo(() => {
    if (!payload) return [];

    return payload.trip.ciudades.filter((city) =>
      payload.expenses.some((exp) => exp.ciudad === city)
    );
  }, [payload]);

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
        <h1 className="text-3xl font-bold text-stone-950">Estadísticas</h1>
        <p className="mt-2 text-sm text-stone-600">Análisis de gastos del viaje</p>
      </div>

      <section className="overflow-hidden rounded-[1.9rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,244,240,0.98))] p-5 text-stone-950 shadow-[0_18px_50px_rgba(28,25,23,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          Gasto total del viaje
        </p>
        <strong className="block text-4xl font-semibold text-stone-950">
          {formatCurrency(payload.summary.gastoTotal, "USD")}
        </strong>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(28,25,23,0.04)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">gastos</p>
            <p className="mt-1 text-lg font-semibold text-stone-950">{payload.expenses.length}</p>
          </div>
          <div className="rounded-[1.2rem] border border-teal-100 bg-teal-50/70 px-4 py-3 shadow-[0_10px_24px_rgba(13,148,136,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-teal-700">ciudades</p>
            <p className="mt-1 text-lg font-semibold text-teal-950">{citiesWithExpenses.length}</p>
          </div>
        </div>
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
                  : 0,
                "USD"
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Mayor gasto</span>
            <span className="font-semibold text-stone-950">
              {formatCurrency(Math.max(...payload.expenses.map((e) => e.monto), 0), "USD")}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
