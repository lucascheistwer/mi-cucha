"use client";

import Link from "next/link";
import { useState } from "react";

import { formatCurrency } from "@/lib/utils";
import type { ActiveDebtSettlement } from "@/types/expense";
import type { TripDetail } from "@/types/trip";

type TripManageBarProps = {
  trip: TripDetail;
  outstandingDebt: Pick<ActiveDebtSettlement, "fromNombre" | "toNombre" | "amount"> | null;
  onUpdated: (trip: TripDetail) => void;
};

export function TripManageBar({ trip, outstandingDebt, onUpdated }: TripManageBarProps) {
  const [pendingEstado, setPendingEstado] = useState<"activo" | "finalizado" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const isFinalized = trip.estado === "finalizado";

  function closeDialog() {
    if (isSaving) {
      return;
    }

    setPendingEstado(null);
    setError("");
  }

  async function confirmStatusChange() {
    if (!pendingEstado) {
      return;
    }

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(`/api/trips/${trip._id}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: pendingEstado }),
      });
      const data = (await response.json().catch(() => null)) as
        | { trip?: TripDetail }
        | { error?: string }
        | null;

      if (!response.ok || !data || !("trip" in data) || !data.trip) {
        setError(
          (data && "error" in data ? data.error : null) || "No pudimos actualizar el estado del viaje."
        );
        setIsSaving(false);
        return;
      }

      onUpdated(data.trip);
      setFeedback(pendingEstado === "finalizado" ? "Viaje finalizado." : "Viaje reabierto.");
      setPendingEstado(null);
      setIsSaving(false);
    } catch {
      setError("No pudimos actualizar el estado del viaje.");
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {isFinalized ? (
        <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-700">
          Este viaje está finalizado. No se pueden cargar ni modificar gastos ni pagos. Si necesitás
          corregir algo, podés reabrirlo.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/viajes/${trip._id}/editar`}
          className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
        >
          Editar viaje
        </Link>
        {isFinalized ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setPendingEstado("activo");
            }}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
          >
            Reabrir viaje
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError("");
              setPendingEstado("finalizado");
            }}
            className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-teal-700"
          >
            Finalizar viaje
          </button>
        )}
      </div>

      {feedback ? (
        <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-800">{feedback}</p>
      ) : null}

      {error && !pendingEstado ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {pendingEstado ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-status-title"
            className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-[0_20px_80px_rgba(28,25,23,0.32)]"
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                {pendingEstado === "finalizado" ? "Confirmar cierre" : "Confirmar reapertura"}
              </p>
              <h2 id="trip-status-title" className="text-2xl font-semibold tracking-tight text-stone-950">
                {pendingEstado === "finalizado" ? "¿Querés finalizar el viaje?" : "¿Querés reabrir el viaje?"}
              </h2>
              <p className="text-sm leading-6 text-stone-700">
                {pendingEstado === "finalizado"
                  ? "El viaje pasa a finalizados y deja de aceptar gastos y pagos nuevos. El historial se mantiene, y podés reabrirlo después."
                  : "El viaje vuelve a estar activo. Vas a poder cargar y editar gastos y pagos otra vez."}
              </p>
              {pendingEstado === "finalizado" && outstandingDebt ? (
                <div className="rounded-[1.4rem] bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  {outstandingDebt.fromNombre} todavía le debe{" "}
                  {formatCurrency(outstandingDebt.amount, "USD")} a {outstandingDebt.toNombre}. Podés
                  finalizar igual: la deuda queda registrada.
                </div>
              ) : null}
              {error ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSaving}
                className="flex-1 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmStatusChange();
                }}
                disabled={isSaving}
                className="flex-1 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Guardando..."
                  : pendingEstado === "finalizado"
                    ? "Sí, finalizar"
                    : "Sí, reabrir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
