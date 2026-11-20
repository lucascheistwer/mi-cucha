"use client";

import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import {
  formatMonthStartQuestion,
  SUGGESTION_SNOOZE_DAYS,
  type ExpenseTemplate,
} from "@/lib/expense-suggestions";
import { formatCurrency } from "@/lib/utils";

type MonthStartSuggestionsProps = {
  suggestions: ExpenseTemplate[];
  onUse: (template: ExpenseTemplate) => void;
  onDismiss: (template: ExpenseTemplate) => void;
  onSnooze: () => void;
};

function categoryIcon(value: string) {
  return EXPENSE_CATEGORIES.find((category) => category.value === value)?.icon ?? "✨";
}

export function MonthStartSuggestions({
  suggestions,
  onUse,
  onDismiss,
  onSnooze,
}: MonthStartSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  const question = formatMonthStartQuestion(suggestions.map((suggestion) => suggestion.displayName));

  return (
    <section
      aria-label="Gastos fijos de principio de mes"
      className="rounded-[1.4rem] border border-amber-200/90 bg-amber-50/90 px-3.5 py-3.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
        Principio de mes
      </p>
      <h2 className="mt-1 text-base font-semibold leading-snug text-stone-950">{question}</h2>
      <p className="mt-1 text-xs leading-5 text-stone-600">
        Tocá uno y completá el monto. El último pago queda de referencia.
      </p>

      <ul className="mt-3 space-y-2">
        {suggestions.map((suggestion) => (
          <li key={`${suggestion.normalizedName}:${suggestion.categoria}`} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUse(suggestion)}
              aria-label={`Cargar ${suggestion.displayName}. Último monto ${formatCurrency(suggestion.lastAmount)}`}
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-left shadow-sm transition hover:bg-amber-100/60"
            >
              <span className="min-w-0 truncate text-sm font-medium text-stone-900">
                <span aria-hidden="true">{categoryIcon(suggestion.categoria)} </span>
                {suggestion.displayName}
              </span>
              <span className="shrink-0 text-xs font-medium text-stone-500">
                último {formatCurrency(suggestion.lastAmount)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDismiss(suggestion)}
              aria-label={`Descartar ${suggestion.displayName} este mes`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg text-stone-500 transition hover:bg-white hover:text-stone-800"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSnooze}
        className="mt-3 text-sm font-medium text-stone-600 underline-offset-2 hover:underline"
      >
        Ahora no, por {SUGGESTION_SNOOZE_DAYS} días
      </button>
    </section>
  );
}
