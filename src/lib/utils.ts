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
 * Formatea un número como moneda. Por defecto en pesos argentinos;
 * los viajes se expresan en dólares sin decimales. El símbolo "$" solo
 * no alcanza para distinguir ARS de USD, así que en USD anteponemos
 * "US$" explícitamente en vez de depender del símbolo de Intl.
 */
export function formatCurrency(amount: number, currency: "ARS" | "USD" = "ARS"): string {
  if (currency === "USD") {
    const formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    return `US$ ${formattedNumber}`;
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
