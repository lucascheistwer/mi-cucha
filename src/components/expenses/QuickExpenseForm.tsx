"use client";

import { useMemo, useState } from "react";

import { formatMonthLabel, getDefaultInputValueForMonth } from "@/lib/date-helpers";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import type { ExpenseCategoryValue } from "@/lib/expense-categories";
import type { HouseholdUserOption } from "@/types/expense";

function getMonthDateBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    min: `${monthKey}-01`,
    max: `${monthKey}-${`${lastDay}`.padStart(2, "0")}`,
  };
}

type QuickExpenseFormProps = {
  users: HouseholdUserOption[];
  currentUserId: string;
  monthKey: string;
  availableCategories: ExpenseCategoryValue[];
  onCreateExpense: (payload: {
    descripcion: string;
    monto: number;
    categoria: string;
    fecha: string;
    pagadoPor: string;
  }) => Promise<void>;
  isSubmitting: boolean;
};

export function QuickExpenseForm({
  users,
  currentUserId,
  monthKey,
  availableCategories,
  onCreateExpense,
  isSubmitting,
}: QuickExpenseFormProps) {
  const defaultPayerId = useMemo(() => {
    return users.find((user) => user._id === currentUserId)?._id ?? users[0]?._id ?? "";
  }, [currentUserId, users]);
  const categoryOptions = useMemo(() => {
    const filteredCategories = EXPENSE_CATEGORIES.filter((option) =>
      availableCategories.includes(option.value)
    );

    return filteredCategories.length > 0 ? filteredCategories : [...EXPENSE_CATEGORIES];
  }, [availableCategories]);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<string>(categoryOptions[0]?.value ?? "");
  const [fecha, setFecha] = useState(getDefaultInputValueForMonth(monthKey));
  const [pagadoPor, setPagadoPor] = useState(defaultPayerId);
  const dateBounds = useMemo(() => getMonthDateBounds(monthKey), [monthKey]);
  const safeCategoria = categoryOptions.some((option) => option.value === categoria)
    ? categoria
    : categoryOptions[0]?.value ?? "";
  const safeFecha =
    fecha >= dateBounds.min && fecha <= dateBounds.max
      ? fecha
      : getDefaultInputValueForMonth(monthKey);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onCreateExpense({
      descripcion,
      monto: Number(monto),
      categoria: safeCategoria,
      fecha: safeFecha,
      pagadoPor,
    });

    setDescripcion("");
    setMonto("");
    setCategoria(categoryOptions[0]?.value ?? "");
    setFecha(getDefaultInputValueForMonth(monthKey));
    setPagadoPor(defaultPayerId);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="descripcion" className="text-sm font-medium text-stone-700">
          Descripción
        </label>
        <input
          id="descripcion"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          placeholder="Ej: súper, farmacia, nafta"
          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
          disabled={isSubmitting}
          required
          minLength={2}
          maxLength={200}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label htmlFor="monto" className="text-sm font-medium text-stone-700">
            Monto
          </label>
          <input
            id="monto"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
            placeholder="0"
            className="w-full min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="min-w-0 space-y-2">
          <label htmlFor="fecha" className="text-sm font-medium text-stone-700">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            value={safeFecha}
            onChange={(event) => setFecha(event.target.value)}
            min={dateBounds.min}
            max={dateBounds.max}
            className="w-full min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white sm:text-base"
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-stone-500">
            Solo se aceptan fechas de {formatMonthLabel(monthKey)}.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="categoria" className="text-sm font-medium text-stone-700">
          Categoría
        </label>
        <div className="relative">
          <select
            id="categoria"
            value={safeCategoria}
            onChange={(event) => setCategoria(event.target.value)}
            className="w-full appearance-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 pr-12 text-base text-stone-900 outline-none transition focus:border-teal-600 focus:bg-white"
            disabled={isSubmitting}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.icon} {option.label}
              </option>
            ))}
          </select>

          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-5 w-5"
            >
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
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-stone-700">Quién lo pagó</span>
        <div className="grid gap-2 rounded-3xl bg-stone-100 p-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(users.length, 1)}, minmax(0, 1fr))` }}>
          {users.map((user) => {
            const isActive = pagadoPor === user._id;

            return (
              <button
                key={user._id}
                type="button"
                onClick={() => setPagadoPor(user._id)}
                className={`rounded-[1.2rem] px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-stone-950 text-white shadow-sm"
                    : "bg-transparent text-stone-600"
                }`}
                disabled={isSubmitting}
              >
                {user.nombre}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || users.length === 0}
        className="flex w-full items-center justify-center rounded-2xl bg-teal-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Guardando..." : "Agregar gasto"}
      </button>
    </form>
  );
}
