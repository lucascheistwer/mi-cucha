"use client";

import { useRouter } from "next/navigation";

import { TripForm, type TripFormValues } from "@/components/trips/TripForm";

const EMPTY_TRIP: TripFormValues = {
  nombre: "",
  descripcion: "",
  fechaInicio: "",
  fechaFin: "",
  ciudades: [],
};

export function NewTripScreen() {
  const router = useRouter();

  async function handleSubmit(values: TripFormValues) {
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => null)) as
      | { trip?: { _id: string } }
      | { error?: string }
      | null;

    if (!response.ok || !data || !("trip" in data) || !data.trip) {
      return (data && "error" in data ? data.error : null) || "Error al crear el viaje";
    }

    router.push(`/viajes/${data.trip._id}`);
    return null;
  }

  return (
    <TripForm
      title="Nuevo Viaje"
      subtitle="Crea un nuevo viaje para empezar a cargar gastos"
      submitLabel="Crear viaje"
      pendingLabel="Creando..."
      cancelHref="/viajes"
      initialValues={EMPTY_TRIP}
      onSubmit={handleSubmit}
    />
  );
}
