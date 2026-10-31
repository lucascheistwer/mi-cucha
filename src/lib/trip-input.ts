import { parseDateInputValue } from "@/lib/date-helpers";

export const FINALIZED_TRIP_ERROR =
  "Este viaje está finalizado. No se pueden cargar ni modificar gastos ni pagos.";

export const TRIP_ESTADOS = ["activo", "finalizado"] as const;

export type TripEstado = (typeof TRIP_ESTADOS)[number];

export type TripWriteInput = {
  nombre: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  ciudades: string[];
};

export type TripWriteResult =
  | { ok: true; value: TripWriteInput }
  | { ok: false; error: string };

export function isTripEstado(value: unknown): value is TripEstado {
  return value === "activo" || value === "finalizado";
}

export function parseTripWriteInput(body: unknown): TripWriteResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Faltan datos del viaje." };
  }

  const record = body as Record<string, unknown>;
  const nombre = typeof record.nombre === "string" ? record.nombre.trim() : "";
  const descripcion = typeof record.descripcion === "string" ? record.descripcion.trim() : "";
  const fechaInicioInput = typeof record.fechaInicio === "string" ? record.fechaInicio.trim() : "";
  const fechaFinInput = typeof record.fechaFin === "string" ? record.fechaFin.trim() : "";

  if (record.descripcion !== undefined && record.descripcion !== null && typeof record.descripcion !== "string") {
    return { ok: false, error: "La descripción no es válida." };
  }

  if (nombre.length < 2 || nombre.length > 100) {
    return { ok: false, error: "El nombre debe tener entre 2 y 100 caracteres." };
  }

  if (descripcion.length > 500) {
    return { ok: false, error: "La descripción no puede superar los 500 caracteres." };
  }

  const fechaInicio = parseDateInputValue(fechaInicioInput);
  const fechaFin = parseDateInputValue(fechaFinInput);

  if (!fechaInicio || !fechaFin) {
    return { ok: false, error: "Revisá las fechas del viaje." };
  }

  if (fechaInicio.getTime() > fechaFin.getTime()) {
    return { ok: false, error: "La fecha de inicio no puede ser posterior a la de fin." };
  }

  if (!Array.isArray(record.ciudades)) {
    return { ok: false, error: "Tenés que agregar al menos una ciudad." };
  }

  const ciudades: string[] = [];

  for (const rawCity of record.ciudades) {
    if (typeof rawCity !== "string") {
      return { ok: false, error: "Las ciudades deben ser válidas y no estar vacías." };
    }

    const city = rawCity.trim();

    if (city.length < 2 || city.length > 100) {
      return { ok: false, error: "Cada ciudad debe tener entre 2 y 100 caracteres." };
    }

    if (!ciudades.includes(city)) {
      ciudades.push(city);
    }
  }

  if (ciudades.length === 0) {
    return { ok: false, error: "Tenés que agregar al menos una ciudad." };
  }

  return {
    ok: true,
    value: {
      nombre,
      descripcion,
      fechaInicio,
      fechaFin,
      ciudades,
    },
  };
}

/**
 * Cities on expenses are a copied string. Keep the stored label when an expense
 * still uses it, and reject removing a city that any expense references.
 */
export function resolveTripCities(
  currentCities: readonly string[],
  submittedCities: readonly string[],
  expenseCities: readonly string[]
): { ok: true; ciudades: string[] } | { ok: false; error: string } {
  const usedCurrent = new Set<number>();
  const resolved: string[] = [];

  for (const submitted of submittedCities) {
    let matchedIndex = currentCities.findIndex(
      (city, index) => !usedCurrent.has(index) && city === submitted
    );

    if (matchedIndex === -1) {
      matchedIndex = currentCities.findIndex(
        (city, index) => !usedCurrent.has(index) && city.trim() === submitted
      );
    }

    if (matchedIndex === -1) {
      resolved.push(submitted);
      continue;
    }

    usedCurrent.add(matchedIndex);
    const current = currentCities[matchedIndex];
    const expenseUsesCurrent = expenseCities.some((expenseCity) => expenseCity === current);
    resolved.push(expenseUsesCurrent && current !== submitted ? current : submitted);
  }

  const removed = currentCities.filter((_, index) => !usedCurrent.has(index));
  const blocked = removed.filter((city) =>
    expenseCities.some((expenseCity) => expenseCity === city || expenseCity.trim() === city.trim())
  );

  if (blocked.length > 0) {
    const uniqueBlocked = [...new Set(blocked)];
    const quoted = uniqueBlocked.join(", ");
    const noun = uniqueBlocked.length === 1 ? "esa ciudad" : "esas ciudades";

    return {
      ok: false,
      error: `No podés quitar ${quoted} porque ya hay gastos cargados en ${noun}. Esos gastos conservan la ciudad original.`,
    };
  }

  return { ok: true, ciudades: resolved };
}
