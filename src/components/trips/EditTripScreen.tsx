"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TripForm, type TripFormValues } from "@/components/trips/TripForm";
import type { TripDashboardPayload } from "@/types/trip";

type LoadState = {
  payload: TripDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

export function EditTripScreen() {
  const params = useParams();
  const router = useRouter();
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
        const response = await fetch(`/api/trips/${tripId}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | TripDashboardPayload
          | { error?: string }
          | null;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !data || !("trip" in data)) {
          setState({
            payload: null,
            error: (data && "error" in data ? data.error : null) || "No pudimos cargar el viaje.",
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

  async function handleSubmit(values: TripFormValues) {
    const response = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as
      | { trip?: { _id: string } }
      | { error?: string }
      | null;

    if (!response.ok || !data || !("trip" in data) || !data.trip) {
      return (data && "error" in data ? data.error : null) || "No pudimos guardar el viaje.";
    }

    router.push(`/viajes/${tripId}`);
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-64 animate-pulse rounded-[2rem] bg-stone-200" />
      </div>
    );
  }

  if (state.error || !state.payload) {
    return (
      <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
        {state.error || "Error al cargar el viaje"}
      </div>
    );
  }

  const lockedCities = state.payload.trip.ciudades.filter((city) =>
    state.payload?.expenses.some((expense) => expense.ciudad === city)
  );

  return (
    <TripForm
      key={state.payload.trip.updatedAt}
      title="Editar viaje"
      subtitle="Actualizá el nombre, las fechas o las ciudades. Los gastos ya cargados conservan su ciudad."
      submitLabel="Guardar cambios"
      pendingLabel="Guardando..."
      cancelHref={`/viajes/${tripId}`}
      lockedCities={lockedCities}
      initialValues={{
        nombre: state.payload.trip.nombre,
        descripcion: state.payload.trip.descripcion,
        fechaInicio: state.payload.trip.fechaInicio,
        fechaFin: state.payload.trip.fechaFin,
        ciudades: state.payload.trip.ciudades,
      }}
      onSubmit={handleSubmit}
    />
  );
}
