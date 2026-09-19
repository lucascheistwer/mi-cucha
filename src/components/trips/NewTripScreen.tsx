"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";

type NewTripFormData = {
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  ciudades: string[];
  nuevaCiudad: string;
};

export function NewTripScreen() {
  const router = useRouter();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<NewTripFormData>({
    nombre: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    ciudades: [],
    nuevaCiudad: "",
  });

  function handleAddCity() {
    if (formData.nuevaCiudad.trim() && !formData.ciudades.includes(formData.nuevaCiudad)) {
      setFormData((prev) => ({
        ...prev,
        ciudades: [...prev.ciudades, prev.nuevaCiudad],
        nuevaCiudad: "",
      }));
    }
  }

  function handleRemoveCity(city: string) {
    setFormData((prev) => ({
      ...prev,
      ciudades: prev.ciudades.filter((c) => c !== city),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!formData.nombre || !formData.fechaInicio || !formData.fechaFin) {
      setError("El nombre y las fechas son obligatorios.");
      return;
    }

    if (formData.ciudades.length === 0) {
      setError("Debes agregar al menos una ciudad.");
      return;
    }

    if (new Date(formData.fechaInicio) > new Date(formData.fechaFin)) {
      setError("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }

    startSubmitTransition(async () => {
      try {
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            fechaInicio: formData.fechaInicio,
            fechaFin: formData.fechaFin,
            ciudades: formData.ciudades,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Error al crear el viaje");
          return;
        }

        router.push(`/viajes/${data.trip._id}`);
      } catch (err) {
        setError("Error al crear el viaje");
        console.error(err);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-bold text-stone-950">Nuevo Viaje</h1>
        <p className="mt-2 text-sm text-stone-600">
          Crea un nuevo viaje para empezar a cargar gastos
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="nombre" className="text-sm font-medium text-stone-700">
            Nombre del viaje *
          </label>
          <input
            id="nombre"
            value={formData.nombre}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nombre: e.target.value }))
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
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fechaInicio: e.target.value }))
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fechaFin: e.target.value }))
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
              value={formData.nuevaCiudad}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nuevaCiudad: e.target.value }))
              }
              placeholder="Ej: Buenos Aires"
              className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
              disabled={isSubmitting}
              minLength={2}
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCity();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCity}
              disabled={isSubmitting || !formData.nuevaCiudad.trim()}
              className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Agregar
            </button>
          </div>

          {formData.ciudades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.ciudades.map((city) => (
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
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creando..." : "Crear viaje"}
          </button>

          <Link
            href="/viajes"
            className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
