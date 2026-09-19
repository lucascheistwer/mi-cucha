"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TripDetail } from "@/types/trip";

type LoadState = {
  trips: TripDetail[];
  error: string;
  isLoading: boolean;
};

export function TripsScreen() {
  const [state, setState] = useState<LoadState>({
    trips: [],
    error: "",
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadTrips() {
      try {
        const response = await fetch("/api/trips", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | { trips: TripDetail[] }
          | { error?: string }
          | null;

        if (!isMounted) return;

        if (!response.ok || !data || !("trips" in data)) {
          setState({
            trips: [],
            error:
              (data && "error" in data ? data.error : null) ||
              "No pudimos cargar los viajes.",
            isLoading: false,
          });
          return;
        }

        setState({ trips: data.trips, error: "", isLoading: false });
      } catch {
        if (isMounted) {
          setState({
            trips: [],
            error: "Error al cargar los viajes.",
            isLoading: false,
          });
        }
      }
    }

    void loadTrips();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeTrips = state.trips.filter((trip) => trip.estado === "activo");
  const finishedTrips = state.trips.filter((trip) => trip.estado === "finalizado");

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

  if (state.error) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">
          {state.error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-950">Mis Viajes</h1>
          <p className="mt-2 text-sm text-stone-600">
            Gestiona y controla gastos de tus viajes
          </p>
        </div>
        <Link
          href="/viajes/nuevo"
          className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          + Nuevo
        </Link>
      </div>

      {activeTrips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            Viajes Activos
          </h2>
          <div className="space-y-2">
            {activeTrips.map((trip) => (
              <Link
                key={trip._id}
                href={`/viajes/${trip._id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-[0_10px_24px_rgba(28,25,23,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-stone-950">
                      {trip.nombre}
                    </h3>
                    {trip.descripcion && (
                      <p className="mt-1 truncate text-sm text-stone-600">
                        {trip.descripcion}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {trip.ciudades.map((city) => (
                        <span
                          key={city}
                          className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-xs text-stone-600">
                  <span>
                    {trip.fechaInicio} al {trip.fechaFin}
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 font-medium text-teal-700">
                    Activo
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {finishedTrips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            Viajes Finalizados
          </h2>
          <div className="space-y-2 opacity-75">
            {finishedTrips.map((trip) => (
              <Link
                key={trip._id}
                href={`/viajes/${trip._id}`}
                className="block rounded-2xl border border-stone-200 bg-stone-50 p-4 transition hover:border-stone-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-stone-950">
                      {trip.nombre}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {trip.ciudades.map((city) => (
                        <span
                          key={city}
                          className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-xs text-stone-600">
                  <span>
                    {trip.fechaInicio} al {trip.fechaFin}
                  </span>
                  <span className="rounded-full bg-stone-200 px-2 py-1 font-medium text-stone-700">
                    Finalizado
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {state.trips.length === 0 && (
        <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/70 px-5 py-10 text-center">
          <p className="text-base font-medium text-stone-900">
            Aún no creaste ningún viaje.
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Crea uno para empezar a cargar y controlar gastos del viaje.
          </p>
        </div>
      )}
    </div>
  );
}
