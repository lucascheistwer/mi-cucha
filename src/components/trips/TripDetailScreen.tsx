"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { buildTripSummary } from "@/lib/trip-summary";
import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { QuickTripExpenseForm } from "@/components/trips/QuickTripExpenseForm";
import { TripExpenseList, type TripExpenseEditInput } from "@/components/trips/TripExpenseList";
import type { TripDashboardPayload, TripExpenseListItem } from "@/types/trip";

type LoadState = {
  payload: TripDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

export function TripDetailScreen() {
  const params = useParams();
  const tripId = params.tripId as string;
  const router = useRouter();
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
  const [submitError, setSubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

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

  async function handleCreateExpense(input: {
    descripcion: string;
    monto: number;
    categoria: string;
    ciudad: string;
    fecha: string;
    pagadoPor: string;
  }) {
    setSubmitError("");

    return new Promise<void>((resolve) => {
      startSubmitTransition(async () => {
        try {
          const response = await fetch(`/api/trips/${tripId}/expenses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          });

          const data = (await response.json().catch(() => null)) as
            | { expense?: TripExpenseListItem }
            | { error?: string }
            | null;

          if (!response.ok || !data || !("expense" in data) || !data.expense) {
            setSubmitError(
              (data && "error" in data ? data.error : null) ||
                "No pudimos guardar el gasto."
            );
            resolve();
            return;
          }

          const newExpense = data.expense;

          setState((currentState) => {
            if (!currentState.payload) {
              resolve();
              return currentState;
            }

            const expenses = [
              newExpense,
              ...currentState.payload.expenses,
            ].sort(
              (a, b) =>
                new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            );

            const summary = buildTripSummary({
              users: currentState.payload.users,
              expenses,
              percentages: currentState.payload.porcentajesDefecto || {
                user1: 50,
                user2: 50,
              },
            });

            return {
              ...currentState,
              payload: {
                ...currentState.payload,
                expenses,
                summary,
              },
            };
          });

          resolve();
        } catch {
          setSubmitError("Error al crear el gasto.");
          resolve();
        }
      });
    });
  }

  async function handleDeleteExpense(expenseId: string) {
    setDeleteError("");
    setIsDeletingId(expenseId);

    try {
      const response = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setDeleteError(
          (data && "error" in data ? data.error : null) ||
            "No pudimos eliminar el gasto."
        );
        setIsDeletingId(null);
        return;
      }

      setState((currentState) => {
        if (!currentState.payload) {
          setIsDeletingId(null);
          return currentState;
        }

        const expenses = currentState.payload.expenses.filter(
          (exp) => exp._id !== expenseId
        );

        const summary = buildTripSummary({
          users: currentState.payload.users,
          expenses,
          percentages: currentState.payload.porcentajesDefecto || {
            user1: 50,
            user2: 50,
          },
        });

        setIsDeletingId(null);

        return {
          ...currentState,
          payload: {
            ...currentState.payload,
            expenses,
            summary,
          },
        };
      });
    } catch {
      setDeleteError("Error al eliminar el gasto.");
      setIsDeletingId(null);
    }
  }

  async function handleEditExpense(input: TripExpenseEditInput): Promise<boolean> {
    setEditError("");
    setIsEditingId(input.expenseId);

    try {
      const response = await fetch(
        `/api/trips/${tripId}/expenses/${input.expenseId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            descripcion: input.descripcion,
            monto: input.monto,
            categoria: input.categoria,
            ciudad: input.ciudad,
            fecha: input.fecha,
            pagadoPor: input.pagadoPor,
          }),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | { expense?: TripExpenseListItem }
        | { error?: string }
        | null;

      if (!response.ok || !data || !("expense" in data) || !data.expense) {
        setEditError(
          (data && "error" in data ? data.error : null) ||
            "No pudimos actualizar el gasto."
        );
        setIsEditingId(null);
        return false;
      }

      const updatedExpense = data.expense;

      setState((currentState) => {
        if (!currentState.payload) {
          return currentState;
        }

        const expenses = currentState.payload.expenses
          .map((exp) => (exp._id === updatedExpense._id ? updatedExpense : exp))
          .sort(
            (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
          );

        const summary = buildTripSummary({
          users: currentState.payload.users,
          expenses,
          percentages: currentState.payload.porcentajesDefecto || {
            user1: 50,
            user2: 50,
          },
        });

        return {
          ...currentState,
          payload: {
            ...currentState.payload,
            expenses,
            summary,
          },
        };
      });

      setIsEditingId(null);
      return true;
    } catch {
      setEditError("Error al actualizar el gasto.");
      setIsEditingId(null);
      return false;
    }
  }

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

  if (state.error || !state.payload) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-700">
          {state.error || "Error al cargar el viaje"}
        </div>
      </div>
    );
  }

  const { payload } = state;
  const tripCategoryValues = TRIP_EXPENSE_CATEGORIES.map((cat) => cat.value);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link
          href="/viajes"
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          ← Volver a viajes
        </Link>
        <Link
          href={`/viajes/${tripId}/estadisticas`}
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          Ver estadísticas →
        </Link>
      </div>

      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-bold text-stone-950">
              {payload.trip.nombre}
            </h1>
            {payload.trip.descripcion && (
              <p className="mt-2 text-sm text-stone-600">
                {payload.trip.descripcion}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.trip.ciudades.map((city) => (
                <span
                  key={city}
                  className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-900"
                >
                  📍 {city}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <span>
            {payload.trip.fechaInicio} al {payload.trip.fechaFin}
          </span>
          <span className="rounded-full bg-teal-100 px-2 py-1 font-medium text-teal-700">
            {payload.trip.estado === "activo" ? "Activo" : "Finalizado"}
          </span>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Gasto Total
        </h2>
        <p className="text-3xl font-bold text-stone-950">
          {formatCurrency(payload.summary.gastoTotal)}
        </p>
        <div className="mt-3 space-y-1.5">
          {payload.users.map((user) => {
            const totalPaid =
              payload.summary.totalesPorUsuario.find(
                (t) => t.userId === user._id
              )?.totalPagado || 0;
            const balance = payload.summary.balancePorUsuario[user._id] || 0;

            return (
              <div
                key={user._id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-stone-600">
                  {user.nombre} pagó {formatCurrency(totalPaid)}
                </span>
                <span
                  className={`font-semibold ${
                    balance > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {balance > 0 ? "+" : ""}{formatCurrency(balance)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-stone-950">
          Agregar Gasto
        </h2>
        <QuickTripExpenseForm
          users={payload.users}
          currentUserId={payload.currentUserId}
          tripStartDate={payload.trip.fechaInicio}
          tripEndDate={payload.trip.fechaFin}
          ciudades={payload.trip.ciudades}
          availableCategories={tripCategoryValues}
          onCreateExpense={handleCreateExpense}
          isSubmitting={isSubmitting}
        />
        {submitError && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}
      </div>

      {deleteError && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {deleteError}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-950">
          Gastos ({payload.expenses.length})
        </h2>
        <TripExpenseList
          expenses={payload.expenses}
          users={payload.users}
          ciudades={payload.trip.ciudades}
          tripStartDate={payload.trip.fechaInicio}
          tripEndDate={payload.trip.fechaFin}
          onDeleteExpense={handleDeleteExpense}
          onEditExpense={handleEditExpense}
          isDeletingId={isDeletingId}
          isEditingId={isEditingId}
          editError={editError}
        />
      </div>
    </div>
  );
}
