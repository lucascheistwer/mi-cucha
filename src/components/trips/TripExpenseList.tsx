"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/utils";
import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { formatExpenseDate } from "@/lib/date-helpers";
import { getUserAccent } from "@/lib/user-accent";
import type { TripExpenseListItem, HouseholdUserOption } from "@/types/trip";

export type TripExpenseEditInput = {
  expenseId: string;
  descripcion: string;
  monto: number;
  categoria: string;
  ciudad: string;
  fecha: string;
  pagadoPor: string;
};

type TripExpenseListProps = {
  expenses: TripExpenseListItem[];
  users: HouseholdUserOption[];
  ciudades: string[];
  tripStartDate: string;
  tripEndDate: string;
  onDeleteExpense?: (expenseId: string) => Promise<void>;
  onEditExpense?: (input: TripExpenseEditInput) => Promise<boolean>;
  isDeletingId?: string | null;
  isEditingId?: string | null;
  editError?: string;
};

export function TripExpenseList({
  expenses,
  users,
  ciudades,
  tripStartDate,
  tripEndDate,
  onDeleteExpense,
  onEditExpense,
  isDeletingId,
  isEditingId,
  editError,
}: TripExpenseListProps) {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDescripcion, setEditingDescripcion] = useState("");
  const [editingMonto, setEditingMonto] = useState("");
  const [editingCategoria, setEditingCategoria] = useState<string>("");
  const [editingCiudad, setEditingCiudad] = useState<string>("");
  const [editingFecha, setEditingFecha] = useState("");
  const [editingPagadoPor, setEditingPagadoPor] = useState<string>("");
  const visibleEditingExpenseId = expenses.some((expense) => expense._id === editingExpenseId)
    ? editingExpenseId
    : null;

  if (expenses.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/70 px-5 py-10 text-center">
        <p className="text-base font-medium text-stone-900">Todavía no cargaron gastos en este viaje.</p>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          Sumá el primero desde el formulario arriba y lo vas a ver acá ordenado al instante.
        </p>
      </div>
    );
  }

  async function handleDelete(expenseId: string) {
    if (!onDeleteExpense) return;
    await onDeleteExpense(expenseId);
  }

  function startEditingExpense(expense: TripExpenseListItem) {
    setEditingExpenseId(expense._id);
    setEditingDescripcion(expense.descripcion);
    setEditingMonto(`${expense.monto}`);
    setEditingCategoria(expense.categoria);
    setEditingCiudad(expense.ciudad);
    setEditingFecha(expense.fecha.slice(0, 10));
    setEditingPagadoPor(expense.pagadoPorDetalle?._id ?? expense.pagadoPor);
  }

  function cancelEditingExpense() {
    setEditingExpenseId(null);
    setEditingDescripcion("");
    setEditingMonto("");
    setEditingCategoria("");
    setEditingCiudad("");
    setEditingFecha("");
    setEditingPagadoPor("");
  }

  async function handleSubmitEdit(expenseId: string) {
    if (!onEditExpense) return;

    const safeCategoria = TRIP_EXPENSE_CATEGORIES.some((option) => option.value === editingCategoria)
      ? editingCategoria
      : TRIP_EXPENSE_CATEGORIES[0]?.value ?? "";
    const safeCiudad = ciudades.includes(editingCiudad) ? editingCiudad : ciudades[0] ?? editingCiudad;
    const safeFecha =
      editingFecha >= tripStartDate && editingFecha <= tripEndDate ? editingFecha : tripStartDate;
    const safePagadoPor = users.some((user) => user._id === editingPagadoPor)
      ? editingPagadoPor
      : users[0]?._id ?? "";

    const wasSaved = await onEditExpense({
      expenseId,
      descripcion: editingDescripcion,
      monto: Number(editingMonto),
      categoria: safeCategoria,
      ciudad: safeCiudad,
      fecha: safeFecha,
      pagadoPor: safePagadoPor,
    });

    if (wasSaved) {
      cancelEditingExpense();
    }
  }

  return (
    <div className="rounded-[1.8rem] border border-white/70 bg-white/85 shadow-[0_16px_36px_rgba(28,25,23,0.08)] backdrop-blur">
      <div className="space-y-3 p-3">
        {expenses.map((expense) => {
          const category = TRIP_EXPENSE_CATEGORIES.find(
            (item) => item.value === expense.categoria
          );
          const payerName = expense.pagadoPorDetalle?.nombre ?? "Usuario";
          const payerAccent = getUserAccent(users, expense.pagadoPorDetalle?._id ?? expense.pagadoPor);
          const isDeleting = isDeletingId === expense._id;
          const isEditingThisExpense = visibleEditingExpenseId === expense._id;
          const isSavingThisExpense = isEditingId === expense._id;

          return (
            <article
              key={expense._id}
              className="rounded-[1.6rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,245,0.96))] px-4 py-4 shadow-[0_12px_28px_rgba(28,25,23,0.06)]"
            >
              {isEditingThisExpense ? (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Descripción
                    </span>
                    <input
                      value={editingDescripcion}
                      onChange={(event) => setEditingDescripcion(event.target.value)}
                      disabled={isSavingThisExpense}
                      minLength={2}
                      maxLength={200}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Monto
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={editingMonto}
                        onChange={(event) => setEditingMonto(event.target.value)}
                        disabled={isSavingThisExpense}
                        className="w-full min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                      />
                    </label>

                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Fecha
                      </span>
                      <input
                        type="date"
                        value={editingFecha}
                        onChange={(event) => setEditingFecha(event.target.value)}
                        min={tripStartDate}
                        max={tripEndDate}
                        disabled={isSavingThisExpense}
                        className="w-full min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Categoría
                      </span>
                      <div className="relative">
                        <select
                          value={editingCategoria}
                          onChange={(event) => setEditingCategoria(event.target.value)}
                          disabled={isSavingThisExpense}
                          className="w-full appearance-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 pr-12 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                        >
                          {TRIP_EXPENSE_CATEGORIES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.icon} {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-500">
                          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                            <path
                              d="M5 7.5 10 12.5 15 7.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </div>
                    </label>

                    <label className="block min-w-0 space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Ciudad
                      </span>
                      <div className="relative">
                        <select
                          value={editingCiudad}
                          onChange={(event) => setEditingCiudad(event.target.value)}
                          disabled={isSavingThisExpense}
                          className="w-full appearance-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 pr-12 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                        >
                          {ciudades.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-500">
                          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                            <path
                              d="M5 7.5 10 12.5 15 7.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </div>
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                      Quién pagó
                    </span>
                    <div
                      className="grid gap-2 rounded-3xl bg-stone-100 p-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.max(users.length, 1)}, minmax(0, 1fr))` }}
                    >
                      {users.map((user) => {
                        const isActive = editingPagadoPor === user._id;

                        return (
                          <button
                            key={user._id}
                            type="button"
                            onClick={() => setEditingPagadoPor(user._id)}
                            disabled={isSavingThisExpense}
                            className={`rounded-[1.2rem] px-3 py-2.5 text-sm font-medium transition ${
                              isActive
                                ? "bg-stone-950 text-white shadow-sm"
                                : "bg-transparent text-stone-600"
                            }`}
                          >
                            {user.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </label>

                  {editError && isEditingThisExpense ? (
                    <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {editError}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditingExpense}
                      disabled={isSavingThisExpense}
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitEdit(expense._id)}
                      disabled={isSavingThisExpense}
                      className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingThisExpense ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[1.02rem] font-semibold leading-6 text-stone-950">
                          {expense.descripcion}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600">
                            <span>{category?.icon ?? "✨"}</span>
                            <span>{category?.label ?? expense.categoria}</span>
                          </span>
                          <span className="h-1 w-1 rounded-full bg-stone-300" />
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                            📍 {expense.ciudad}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-stone-300" />
                          <span>{formatExpenseDate(expense.fecha)}</span>
                        </div>
                      </div>

                      <strong className="shrink-0 text-lg font-semibold tracking-tight text-stone-950">
                        {formatCurrency(expense.monto)}
                      </strong>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200/80 pt-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${payerAccent.borderClassName} ${payerAccent.backgroundClassName} ${payerAccent.textClassName}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${payerAccent.dotClassName}`} />
                        <span className="text-stone-500">Pagó</span>
                        <span className="font-semibold">{payerName}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {onEditExpense && (
                          <button
                            type="button"
                            onClick={() => startEditingExpense(expense)}
                            disabled={isDeleting || isSavingThisExpense}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-700 transition hover:border-teal-300 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Editar gasto ${expense.descripcion}`}
                            title="Editar gasto"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                              <path d="m13.5 6.5 4 4" />
                            </svg>
                          </button>
                        )}
                        {onDeleteExpense && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(expense._id)}
                            disabled={isDeleting || isSavingThisExpense}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-700 transition hover:border-rose-300 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Eliminar gasto ${expense.descripcion}`}
                            title="Eliminar gasto"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
