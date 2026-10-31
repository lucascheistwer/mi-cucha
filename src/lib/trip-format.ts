import type { HouseholdUserOption, TripDetail } from "@/types/trip";

type PopulatedCreator = {
  _id: { toString(): string };
  nombre: string;
  username: string;
};

function isPopulatedCreator(value: unknown): value is PopulatedCreator {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    _id?: { toString?: unknown };
    nombre?: unknown;
    username?: unknown;
  };

  return (
    typeof candidate._id?.toString === "function" &&
    typeof candidate.nombre === "string" &&
    typeof candidate.username === "string"
  );
}

export function toHouseholdUser(value: unknown): HouseholdUserOption | null {
  if (!isPopulatedCreator(value)) {
    return null;
  }

  return {
    _id: value._id.toString(),
    nombre: value.nombre,
    username: value.username,
  };
}

export function formatTripDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function toTripDetail(trip: {
  _id: { toString(): string };
  hogarId: { toString(): string };
  nombre: string;
  descripcion?: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  ciudades?: string[] | null;
  estado?: string | null;
  creadoPor: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TripDetail | null {
  if (!isPopulatedCreator(trip.creadoPor)) {
    return null;
  }

  return {
    _id: trip._id.toString(),
    hogarId: trip.hogarId.toString(),
    nombre: trip.nombre,
    descripcion: trip.descripcion ?? "",
    fechaInicio: formatTripDate(trip.fechaInicio),
    fechaFin: formatTripDate(trip.fechaFin),
    ciudades: trip.ciudades ?? [],
    estado: trip.estado === "finalizado" ? "finalizado" : "activo",
    creadoPor: trip.creadoPor._id.toString(),
    creadoPorDetalle: {
      _id: trip.creadoPor._id.toString(),
      nombre: trip.creadoPor.nombre,
      username: trip.creadoPor.username,
    },
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}
