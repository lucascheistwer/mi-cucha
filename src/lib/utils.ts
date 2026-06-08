import { Expense, ExpenseSummary } from "@/types/expense";

/**
 * Calcula un cierre simple del mes repartiendo el gasto total en partes iguales.
 * La salida ya viene agrupada por userId para que pueda persistirse en History.
 */
export function calculateBalance(expenses: Expense[]): ExpenseSummary {
  const totals = expenses.reduce<Record<string, number>>((accumulator, expense) => {
    accumulator[expense.pagadoPor] =
      (accumulator[expense.pagadoPor] ?? 0) + expense.monto;

    return accumulator;
  }, {});

  const gastoTotal = Object.values(totals).reduce(
    (runningTotal, currentValue) => runningTotal + currentValue,
    0
  );
  const participantes = Object.keys(totals).length;
  const cuotaIdeal = participantes > 0 ? gastoTotal / participantes : 0;

  const balancePorUsuario = Object.fromEntries(
    Object.entries(totals).map(([userId, totalPagado]) => [
      userId,
      Number((totalPagado - cuotaIdeal).toFixed(2)),
    ])
  );

  return {
    gastoTotal,
    totalesPorUsuario: Object.entries(totals).map(([userId, totalPagado]) => ({
      userId,
      totalPagado,
    })),
    balancePorUsuario,
  };
}

/**
 * Formatea un número como moneda en pesos argentinos.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}
