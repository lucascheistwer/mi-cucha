"use client";

import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { formatExpenseDate } from "@/lib/date-helpers";
import type { ExpenseListItem } from "@/types/expense";

type ExpenseListProps = {
  expenses: ExpenseListItem[];
  currentPage: number;
  totalPages: number;
  isDeletingId: string | null;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onPageChange: (page: number) => void;
};

export function ExpenseList({
  expenses,
  currentPage,
  totalPages,
  isDeletingId,
  onDeleteExpense,
  onPageChange,
}: ExpenseListProps) {
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

  return (
    <div className="space-y-3">
      {expenses.map((expense) => {
        const category = EXPENSE_CATEGORIES.find(
          (item) => item.value === expense.categoria
        );
        const payerName = expense.pagadoPorDetalle?.nombre ?? "Usuario";

        return (
          <article
            key={expense._id}
            className="rounded-[1.6rem] border border-white/70 bg-white/90 p-4 shadow-[0_12px_30px_rgba(28,25,23,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm text-stone-500">
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
                <button
                  type="button"
                  onClick={() => onDeleteExpense(expense._id)}
                  disabled={isDeletingId === expense._id}
                  className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingId === expense._id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </article>
        );
      })}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-[1.6rem] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_12px_30px_rgba(28,25,23,0.06)]">
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
      ) : null}
    </div>
  );
}