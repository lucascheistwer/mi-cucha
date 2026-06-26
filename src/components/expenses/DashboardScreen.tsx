"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { withUpdatedDashboardSummary } from "@/lib/dashboard-summary";
import { formatMonthLabel } from "@/lib/date-helpers";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { QuickExpenseForm } from "@/components/expenses/QuickExpenseForm";
import type { ExpenseCategoryValue } from "@/lib/expense-categories";
import type {
  ExpenseListItem,
  ExpensesDashboardPayload,
} from "@/types/expense";

const EXPENSES_PER_PAGE = 5;

type LoadState = {
  payload: ExpensesDashboardPayload | null;
  error: string;
  isLoading: boolean;
};

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

export function DashboardScreen() {
  const [state, setState] = useState<LoadState>({
    payload: null,
    error: "",
    isLoading: true,
  });
  const [submitError, setSubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [editError, setEditError] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExpenses() {
      const response = await fetch("/api/expenses", { cache: "no-store" });
      const data = await parseJson<ExpensesDashboardPayload & { error?: string }>(response);

      if (!isMounted) {
        return;
      }

      if (!response.ok || !data) {
        setState({
          payload: null,
          error: data?.error ?? "No pudimos cargar los gastos del mes.",
          isLoading: false,
        });
        return;
      }

      setState({ payload: data, error: "", isLoading: false });
    }

    void loadExpenses();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateExpense(input: {
    descripcion: string;
    monto: number;
    categoria: string;
    fecha: string;
    pagadoPor: string;
  }) {
    setSubmitError("");
    setEditError("");

    return new Promise<void>((resolve) => {
      startSubmitTransition(async () => {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });

        const data = await parseJson<{ error?: string; expense?: ExpenseListItem }>(response);

        if (!response.ok || !data?.expense) {
          setSubmitError(data?.error ?? "No pudimos guardar el gasto.");
          resolve();
          return;
        }

        const createdExpense = data.expense;

        setState((currentState) => {
          if (!currentState.payload) {
            resolve();
            return currentState;
          }

          const expenses = [createdExpense, ...currentState.payload.expenses].sort(
            (firstExpense, secondExpense) =>
              new Date(secondExpense.fecha).getTime() -
              new Date(firstExpense.fecha).getTime()
          );
          const payload = withUpdatedDashboardSummary({
            ...currentState.payload,
            expenses,
          });

          return {
            ...currentState,
            payload,
          };
        });
        setCurrentPage(1);

        resolve();
      });
    });
  }

  async function handleDeleteExpense(expenseId: string) {
    const shouldDelete = window.confirm("¿Querés eliminar este gasto?");

    if (!shouldDelete) {
      return;
    }

    setDeleteError("");
    setIsDeletingId(expenseId);

    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE",
    });
    const data = await parseJson<{ error?: string }>(response);

    if (!response.ok) {
      setDeleteError(data?.error ?? "No pudimos eliminar el gasto.");
      setIsDeletingId(null);
      return;
    }

    setState((currentState) => {
      if (!currentState.payload) {
        return currentState;
      }

      const payload = withUpdatedDashboardSummary({
        ...currentState.payload,
        expenses: currentState.payload.expenses.filter(
          (expense) => expense._id !== expenseId
        ),
      });

      return {
        ...currentState,
        payload,
      };
    });
    setIsDeletingId(null);
  }

  async function handleEditExpense(input: {
    expenseId: string;
    descripcion: string;
    monto: number;
    categoria: string;
    fecha: string;
  }) {
    setEditError("");
    setIsEditingId(input.expenseId);

    const response = await fetch(`/api/expenses/${input.expenseId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        descripcion: input.descripcion,
        monto: input.monto,
        categoria: input.categoria,
        fecha: input.fecha,
      }),
    });
    const data = await parseJson<{ error?: string; expense?: ExpenseListItem }>(response);

    if (!response.ok || !data?.expense) {
      setEditError(data?.error ?? "No pudimos actualizar el gasto.");
      setIsEditingId(null);
      return false;
    }

    setState((currentState) => {
      if (!currentState.payload) {
        return currentState;
      }

      const expenses = currentState.payload.expenses.map((expense) =>
        expense._id === input.expenseId
          ? {
              ...expense,
              ...data.expense,
              pagadoPorDetalle: expense.pagadoPorDetalle,
            }
          : expense
      );

      return {
        ...currentState,
        payload: withUpdatedDashboardSummary({
          ...currentState.payload,
          expenses,
        }),
      };
    });
    setIsEditingId(null);
    return true;
  }

  async function handleCopyInviteCode() {
    if (!state.payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.payload.household.inviteCode);
      setInviteFeedback("Código copiado. Se lo podés pasar a la otra persona.");
    } catch {
      setInviteFeedback(
        `Copiá este código manualmente: ${state.payload.household.inviteCode}`
      );
    }
  }

  if (state.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-[2rem] bg-white/70" />
        <div className="h-40 animate-pulse rounded-[2rem] bg-white/60" />
      </div>
    );
  }

  if (state.error || !state.payload) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 px-5 py-6 text-rose-800">
        <h1 className="text-lg font-semibold">No pudimos abrir tu dashboard.</h1>
        <p className="mt-2 text-sm leading-6">{state.error || "Intentá recargar la página."}</p>
      </section>
    );
  }

  const totalPages = Math.max(
    1,
    Math.ceil(state.payload.expenses.length / EXPENSES_PER_PAGE)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedExpenses = state.payload.expenses.slice(
    (safeCurrentPage - 1) * EXPENSES_PER_PAGE,
    safeCurrentPage * EXPENSES_PER_PAGE
  );

  return (
    <div className="space-y-4">
      <section className="relative rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_70px_rgba(28,25,23,0.1)] backdrop-blur">
        <button
          type="button"
          onClick={handleCopyInviteCode}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-teal-200 bg-white/95 text-teal-700 shadow-[0_10px_25px_rgba(13,148,136,0.16)] transition hover:border-teal-300 hover:text-teal-900"
          title="Copiar código para invitar"
          aria-label="Copiar código para invitar"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-3" />
            <path d="M7 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
            <path d="M10 12h8" />
            <path d="m15 7 5 5-5 5" />
          </svg>
          <span className="sr-only">Copiar código para invitar</span>
        </button>

        <div className="space-y-3">
          <div className="pr-14">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              dashboard móvil
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
              Gastos de {formatMonthLabel(state.payload.currentMonth)}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.4rem] bg-stone-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">cargados</p>
              <p className="mt-1 text-lg font-semibold text-stone-950">
                {state.payload.expenses.length}
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-stone-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">personas</p>
              <p className="mt-1 text-lg font-semibold text-stone-950">
                {state.payload.users.length}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/resumen"
                className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
              >
                Ver resumen
              </Link>
              <Link
                href="/configuracion"
                className="inline-flex rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
              >
                Configuración
              </Link>
            </div>
          </div>

          {inviteFeedback ? (
            <p className="text-xs leading-5 text-teal-800">{inviteFeedback}</p>
          ) : null}

          <QuickExpenseForm
            users={state.payload.users}
            currentUserId={state.payload.currentUserId}
            monthKey={state.payload.currentMonth}
            availableCategories={state.payload.household.categoriasHabilitadas}
            onCreateExpense={handleCreateExpense}
            isSubmitting={isSubmitting}
          />

          {submitError ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-stone-950">Movimientos del mes</h2>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            recientes primero
          </span>
        </div>

        {deleteError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {deleteError}
          </p>
        ) : null}

        <ExpenseList
          expenses={paginatedExpenses}
          users={state.payload.users}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          monthKey={state.payload.currentMonth}
          availableCategories={
            state.payload.household.categoriasHabilitadas as ExpenseCategoryValue[]
          }
          isDeletingId={isDeletingId}
          isEditingId={isEditingId}
          editError={editError}
          onDeleteExpense={handleDeleteExpense}
          onEditExpense={handleEditExpense}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  );
}
