"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { parseTripWriteInput } from "@/lib/trip-input";

export type TripFormValues = {
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  ciudades: string[];
};

type TripFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  initialValues: TripFormValues;
  lockedCities?: string[];
  onSubmit: (values: TripFormValues) => Promise<string | null>;
};

export function TripForm({
  title,
  subtitle,
  submitLabel,
  pendingLabel,
  cancelHref,
  initialValues,
  lockedCities = [],
  onSubmit,
}: TripFormProps) {
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [error, setError] = useState("");
  const [nuevaCiudad, setNuevaCiudad] = useState("");
  const [formData, setFormData] = useState<TripFormValues>(initialValues);

  function handleAddCity() {
    const city = nuevaCiudad.trim();

    if (city.length < 2 || city.length > 100) {
      setError("Cada ciudad debe tener entre 2 y 100 caracteres.");
      return;
    }

    if (formData.ciudades.some((currentCity) => currentCity.trim() === city)) {
      setError("Esa ciudad ya está en el viaje.");
      return;
    }

    setError("");
    setFormData((current) => ({
      ...current,
      ciudades: [...current.ciudades, city],
    }));
    setNuevaCiudad("");
  }

  function handleRemoveCity(city: string) {
    if (lockedCities.includes(city)) {
      setError(`No podés quitar ${city} porque ya hay gastos cargados en esa ciudad.`);
      return;
    }

    setError("");
    setFormData((current) => ({
      ...current,
      ciudades: current.ciudades.filter((currentCity) => currentCity !== city),
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsed = parseTripWriteInput({
      ...formData,
      ciudades: formData.ciudades,
    });

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    startSubmitTransition(async () => {
      try {
        const submitError = await onSubmit({
          nombre: parsed.value.nombre,
          descripcion: parsed.value.descripcion,
          fechaInicio: formData.fechaInicio.trim(),
          fechaFin: formData.fechaFin.trim(),
          ciudades: parsed.value.ciudades,
        });

        if (submitError) {
          setError(submitError);
        }
      } catch {
        setError("No pudimos guardar el viaje.");
      }
    });
  }

  const hasLockedCities = formData.ciudades.some((city) => lockedCities.includes(city));

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950">{title}</h1>
        <p className="mt-2 text-sm text-stone-600">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="nombre" className="text-sm font-medium text-stone-700">
            Nombre del viaje *
          </label>
          <input
            id="nombre"
            value={formData.nombre}
            onChange={(event) =>
              setFormData((current) => ({ ...current, nombre: event.target.value }))
            }
            placeholder="Ej: Viaje a Europa"
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
            disabled={isSubmitting}
            required
            minLength={2}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="descripcion" className="text-sm font-medium text-stone-700">
            Descripción (opcional)
          </label>
          <textarea
            id="descripcion"
            value={formData.descripcion}
            onChange={(event) =>
              setFormData((current) => ({ ...current, descripcion: event.target.value }))
            }
            placeholder="Agrega detalles sobre el viaje..."
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
            disabled={isSubmitting}
            maxLength={500}
            rows={3}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="fechaInicio" className="text-sm font-medium text-stone-700">
              Fecha de inicio *
            </label>
            <input
              id="fechaInicio"
              type="date"
              value={formData.fechaInicio}
              onChange={(event) =>
                setFormData((current) => ({ ...current, fechaInicio: event.target.value }))
              }
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="fechaFin" className="text-sm font-medium text-stone-700">
              Fecha de fin *
            </label>
            <input
              id="fechaFin"
              type="date"
              value={formData.fechaFin}
              onChange={(event) =>
                setFormData((current) => ({ ...current, fechaFin: event.target.value }))
              }
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="nuevaCiudad" className="text-sm font-medium text-stone-700">
            Agregar ciudades *
          </label>
          <div className="flex gap-2">
            <input
              id="nuevaCiudad"
              value={nuevaCiudad}
              onChange={(event) => setNuevaCiudad(event.target.value)}
              placeholder="Ej: Buenos Aires"
              className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
              disabled={isSubmitting}
              maxLength={100}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddCity();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCity}
              disabled={isSubmitting || nuevaCiudad.trim().length < 2}
              className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Agregar
            </button>
          </div>

          {formData.ciudades.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formData.ciudades.map((city) => {
                const isLocked = lockedCities.includes(city);

                if (isLocked) {
                  return (
                    <span
                      key={city}
                      title="Hay gastos cargados en esta ciudad"
                      className="inline-flex items-center rounded-full bg-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700"
                    >
                      📍 {city}
                    </span>
                  );
                }

                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleRemoveCity(city)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    📍 {city}
                    <span className="font-bold">×</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {hasLockedCities ? (
            <p className="text-xs leading-5 text-stone-500">
              Las ciudades con gastos no se pueden quitar. Esos gastos conservan la ciudad original.
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? pendingLabel : submitLabel}
          </button>

          <Link
            href={cancelHref}
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
