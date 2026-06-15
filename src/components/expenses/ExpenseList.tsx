"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { formatExpenseDate, getDefaultInputValueForMonth } from "@/lib/date-helpers";
import type { ExpenseCategoryValue } from "@/lib/expense-categories";
import type { ExpenseListItem } from "@/types/expense";

function getMonthDateBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    min: `${monthKey}-01`,
    max: `${monthKey}-${`${lastDay}`.padStart(2, "0")}`,
  };
}

type ExpenseListProps = {
  expenses: ExpenseListItem[];
  currentPage: number;
  totalPages: number;
  monthKey: string;
  availableCategories: ExpenseCategoryValue[];
  isDeletingId: string | null;
  isEditingId: string | null;
  editError: string;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onEditExpense: (input: {
    expenseId: string;
    descripcion: string;
    monto: number;
    categoria: string;
    fecha: string;
  }) => Promise<boolean>;
  onPageChange: (page: number) => void;
};

export function ExpenseList({
  expenses,
  currentPage,
  totalPages,
  monthKey,
  availableCategories,
  isDeletingId,
  isEditingId,
  editError,
  onDeleteExpense,
  onEditExpense,
  onPageChange,
}: ExpenseListProps) {
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingDescripcion, setEditingDescripcion] = useState("");
  const [editingMonto, setEditingMonto] = useState("");
  const [editingCategoria, setEditingCategoria] = useState<string>("");
  const [editingFecha, setEditingFecha] = useState("");
  const visibleEditingExpenseId = expenses.some((expense) => expense._id === editingExpenseId)
    ? editingExpenseId
    : null;
  const dateBounds = getMonthDateBounds(monthKey);
  const categoryOptions = EXPENSE_CATEGORIES.filter((option) =>
    availableCategories.includes(option.value)
  );
  const visibleCategoryOptions =
    categoryOptions.length > 0 ? categoryOptions : [...EXPENSE_CATEGORIES];

  if (expenses.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-white/70 px-5 py-10 text-center">
        <p className="text-base font-medium text-stone-900">Todavía no cargaron gastos este mes.</p>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          Sumá el primero desde el formulario rápido y lo vas a ver acá ordenado al instante.
        </p>
      </div>
    );
  }

  function startEditingExpense(expense: ExpenseListItem) {
    setEditingExpenseId(expense._id);
    setEditingDescripcion(expense.descripcion);
    setEditingMonto(`${expense.monto}`);
    setEditingCategoria(expense.categoria);
    setEditingFecha(expense.fecha.slice(0, 10));
  }

  function cancelEditingExpense() {
    setEditingExpenseId(null);
    setEditingDescripcion("");
    setEditingMonto("");
    setEditingCategoria("");
    setEditingFecha("");
  }

  async function handleSubmitEdit(expenseId: string) {
    const safeCategoria = visibleCategoryOptions.some((option) => option.value === editingCategoria)
      ? editingCategoria
      : visibleCategoryOptions[0]?.value ?? "";
    const safeFecha =
      editingFecha >= dateBounds.min && editingFecha <= dateBounds.max
        ? editingFecha
        : getDefaultInputValueForMonth(monthKey);
    const wasSaved = await onEditExpense({
      expenseId,
      descripcion: editingDescripcion,
      monto: Number(editingMonto),
      categoria: safeCategoria,
      fecha: safeFecha,
    });

    if (wasSaved) {
      cancelEditingExpense();
    }
  }

  return (
    <div className="rounded-[1.8rem] border border-white/70 bg-white/85 shadow-[0_16px_36px_rgba(28,25,23,0.08)] backdrop-blur">
      <div className="flex min-h-[34rem] flex-col">
        <div className="flex-1 space-y-3 p-3">
          {expenses.map((expense) => {
            const category = EXPENSE_CATEGORIES.find(
              (item) => item.value === expense.categoria
            );
            const payerName = expense.pagadoPorDetalle?.nombre ?? "Usuario";
            const isEditingThisExpense = visibleEditingExpenseId === expense._id;
            const isSavingThisExpense = isEditingId === expense._id;

            return (
              <article
                key={expense._id}
                className="rounded-[1.4rem] border border-stone-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(28,25,23,0.06)]"
              >
                {isEditingThisExpense ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                        {category?.icon ?? "✨"} {category?.label ?? expense.categoria}
                      </span>
                      <span>{formatExpenseDate(expense.fecha)}</span>
                      <span>Pagó {payerName}</span>
                    </div>

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

                    <label className="block space-y-1.5">
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
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                      />
                    </label>

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
                            {visibleCategoryOptions.map((option) => (
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
                          Fecha
                        </span>
                        <input
                          type="date"
                          value={editingFecha}
                          onChange={(event) => setEditingFecha(event.target.value)}
                          min={dateBounds.min}
                          max={dateBounds.max}
                          disabled={isSavingThisExpense}
                          className="w-full min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-teal-600 focus:bg-white"
                        />
                      </label>
                    </div>

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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                          {category?.icon ?? "✨"} {category?.label ?? expense.categoria}
                        </span>
                        <span>{formatExpenseDate(expense.fecha)}</span>
                      </div>
                      <h3 className="truncate text-base font-semibold text-stone-950">
                        {expense.descripcion}
                      </h3>
                      <p className="text-sm text-stone-600">Pagó {payerName}</p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <strong className="text-base font-semibold text-stone-950">
                        {formatCurrency(expense.monto)}
                      </strong>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingExpense(expense)}
                          disabled={isDeletingId === expense._id || isEditingId === expense._id}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 transition hover:border-teal-300 hover:text-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Editar gasto ${expense.descripcion}`}
                          title="Editar gasto"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                            <path d="m13.5 6.5 4 4" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(expense._id)}
                          disabled={isDeletingId === expense._id || isEditingId === expense._id}
                          className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === expense._id ? "Eliminando..." : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="border-t border-stone-200/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Página {currentPage} de {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Ver gastos más nuevos"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Ver gastos más antiguos"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
