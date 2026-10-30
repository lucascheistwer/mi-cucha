"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BalanceOverview, SummaryPanel } from "@/components/shared/SummaryShells";
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
      <div className="space-y-4">
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
      <div className="space-y-4">
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">
          {state.error || "Error al cargar el viaje"}
        </div>
      </div>
    );
  }

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
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Estadísticas</h1>
          <p className="text-sm text-stone-600">Análisis de gastos del viaje</p>
        </div>
      </section>

      <SummaryPanel>
        <BalanceOverview
          eyebrow="Gasto total del viaje"
          total={formatCurrency(payload.summary.gastoTotal, "USD")}
          primaryStat={{ label: "gastos", value: payload.expenses.length }}
          secondaryStat={{ label: "ciudades", value: citiesWithExpenses.length }}
        />
      </SummaryPanel>

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
