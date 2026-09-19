import { TRIP_EXPENSE_CATEGORIES } from "@/lib/trip-expense-categories";
import { formatCurrency } from "@/lib/utils";
import type {
  TripExpenseSummary,
  TripExpenseListItem,
  TripDashboardPayload,
  HouseholdUserOption,
} from "@/types/trip";

type TripSummaryInput = {
  users: HouseholdUserOption[];
  expenses: TripExpenseListItem[];
  percentages: {
    user1: number;
    user2: number;
  };
};

const categoryCatalog = new Map<string, (typeof TRIP_EXPENSE_CATEGORIES)[number]>(
  TRIP_EXPENSE_CATEGORIES.map((category) => [category.value, category])
);

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function buildTripSummary({ users, expenses, percentages }: TripSummaryInput): TripExpenseSummary {
  const totalsByUser = expenses.reduce<Map<string, number>>((accumulator, expense) => {
    accumulator.set(
      expense.pagadoPor,
      roundCurrency((accumulator.get(expense.pagadoPor) ?? 0) + expense.monto)
    );

    return accumulator;
  }, new Map());

  const gastoTotal = roundCurrency(
    Array.from(totalsByUser.values()).reduce(
      (runningTotal, currentValue) => runningTotal + currentValue,
      0
    )
  );

  const hasPairSetup = users.length === 2;

  const balancePorUsuario: Record<string, number> = {};

  if (!hasPairSetup) {
    users.forEach((user) => {
      balancePorUsuario[user._id] = 0;
    });
  } else {
    const spendingByUser = users.map((user, index) => {
      const totalPagado = totalsByUser.get(user._id) ?? 0;
      const porcentajeResponsabilidad = index === 0 ? percentages.user1 : percentages.user2;
      const montoObjetivo = roundCurrency((gastoTotal * porcentajeResponsabilidad) / 100);
      const saldoNeto = roundCurrency(totalPagado - montoObjetivo);

      balancePorUsuario[user._id] = saldoNeto;

      return {
        _id: user._id,
        totalPagado,
        porcentajeResponsabilidad,
        montoObjetivo,
        saldoNeto,
      };
    });
  }

  return {
    gastoTotal,
    totalesPorUsuario: users.map((user) => ({
      userId: user._id,
      totalPagado: totalsByUser.get(user._id) ?? 0,
    })),
    balancePorUsuario,
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
      percentages,
    }),
  };
}
