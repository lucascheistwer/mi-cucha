import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { formatCurrency } from "@/lib/utils";
import type {
  TripExpenseSummary,
  TripExpenseListItem,
  TripPaymentListItem,
  TripDashboardPayload,
  HouseholdUserOption,
} from "@/types/trip";

type TripSummaryInput = {
  users: HouseholdUserOption[];
  expenses: Array<Pick<TripExpenseListItem, "pagadoPor" | "monto">>;
  payments: Array<Pick<TripPaymentListItem, "fromUserId" | "toUserId" | "monto">>;
  percentages: {
    user1: number;
    user2: number;
  };
};

const categoryCatalog = new Map<string, (typeof TRIP_EXPENSE_CATEGORIES)[number]>(
  TRIP_EXPENSE_CATEGORIES.map((category) => [category.value, category])
);

// Los viajes se llevan siempre en dólares enteros, sin decimales.
function roundCurrency(value: number) {
  return Math.round(value);
}

export function buildTripSummary({
  users,
  expenses,
  payments,
  percentages,
}: TripSummaryInput): TripExpenseSummary {
  const totalsByUser = expenses.reduce<Map<string, number>>((accumulator, expense) => {
    accumulator.set(
      expense.pagadoPor,
      roundCurrency((accumulator.get(expense.pagadoPor) ?? 0) + expense.monto)
    );

    return accumulator;
  }, new Map());

  const paymentsByUser = payments.reduce<Map<string, number>>((accumulator, payment) => {
    accumulator.set(
      payment.fromUserId,
      roundCurrency((accumulator.get(payment.fromUserId) ?? 0) + payment.monto)
    );
    accumulator.set(
      payment.toUserId,
      roundCurrency((accumulator.get(payment.toUserId) ?? 0) - payment.monto)
    );

    return accumulator;
  }, new Map());

  const gastoTotal = roundCurrency(
    Array.from(totalsByUser.values()).reduce(
      (runningTotal, currentValue) => runningTotal + currentValue,
      0
    )
  );
  const paymentTotal = roundCurrency(
    payments.reduce((runningTotal, payment) => runningTotal + payment.monto, 0)
  );

  const hasPairSetup = users.length === 2;
  const totalesPorUsuario = users.map((user) => ({
    userId: user._id,
    totalPagado: totalsByUser.get(user._id) ?? 0,
  }));
  const balancePorUsuario: Record<string, number> = {};

  if (!hasPairSetup) {
    users.forEach((user) => {
      balancePorUsuario[user._id] = 0;
    });

    return {
      gastoTotal,
      paymentTotal,
      paymentCount: payments.length,
      totalesPorUsuario,
      balancePorUsuario,
      activeDebt: {
        percentages: null,
        settlement: null,
        message: "La deuda activa se muestra cuando hay exactamente 2 personas en el viaje.",
      },
    };
  }

  const spendingByUser = users.map((user, index) => {
    const totalPagado = totalsByUser.get(user._id) ?? 0;
    const porcentajeResponsabilidad = index === 0 ? percentages.user1 : percentages.user2;
    const montoObjetivo = roundCurrency((gastoTotal * porcentajeResponsabilidad) / 100);
    const saldoNeto = roundCurrency(
      totalPagado - montoObjetivo + (paymentsByUser.get(user._id) ?? 0)
    );

    balancePorUsuario[user._id] = saldoNeto;

    return {
      _id: user._id,
      nombre: user.nombre,
      saldoNeto,
    };
  });

  if (gastoTotal <= 0) {
    return {
      gastoTotal,
      paymentTotal,
      paymentCount: payments.length,
      totalesPorUsuario,
      balancePorUsuario,
      activeDebt: {
        percentages,
        settlement: null,
        message: "Todavía no hay gastos en este viaje, así que no hay deuda activa.",
      },
    };
  }

  const sortedByBalance = [...spendingByUser].sort(
    (firstUser, secondUser) => secondUser.saldoNeto - firstUser.saldoNeto
  );
  const creditor = sortedByBalance[0];
  const debtor = sortedByBalance[sortedByBalance.length - 1];
  const amount = roundCurrency(Math.min(creditor.saldoNeto, Math.abs(debtor.saldoNeto)));

  return {
    gastoTotal,
    paymentTotal,
    paymentCount: payments.length,
    totalesPorUsuario,
    balancePorUsuario,
    activeDebt:
      amount > 0
        ? {
            percentages,
            settlement: {
              fromUserId: debtor._id,
              fromNombre: debtor.nombre,
              toUserId: creditor._id,
              toNombre: creditor.nombre,
              amount,
            },
            message: `${debtor.nombre} le debe ${formatCurrency(amount, "USD")} a ${creditor.nombre}.`,
          }
        : {
            percentages,
            settlement: null,
            message:
              payments.length > 0
                ? "Los pagos cargados dejaron el viaje al día con la distribución configurada."
                : "Por ahora están al día con la distribución configurada.",
          },
  };
}

export function withUpdatedTripSummary(
  payload: TripDashboardPayload,
  percentages: { user1: number; user2: number }
) {
  return {
    ...payload,
    summary: buildTripSummary({
      users: payload.users,
      expenses: payload.expenses,
      payments: payload.payments,
      percentages,
    }),
  };
}
