import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { formatCurrency } from "@/lib/utils";
import type {
  CategorySpendSummary,
  DashboardMathSummary,
  ExpenseListItem,
  ExpensesDashboardPayload,
  HouseholdSummary,
  HouseholdUserOption,
  PaymentListItem,
} from "@/types/expense";

type DashboardSummaryInput = {
  household: HouseholdSummary;
  users: HouseholdUserOption[];
  expenses: ExpenseListItem[];
  payments: PaymentListItem[];
};

const categoryCatalog = new Map<string, (typeof EXPENSE_CATEGORIES)[number]>(
  EXPENSE_CATEGORIES.map((category) => [category.value, category])
);

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function buildCategorySummary(expenses: ExpenseListItem[], gastoTotal: number) {
  const totalsByCategory = expenses.reduce<Map<string, number>>((accumulator, expense) => {
    accumulator.set(
      expense.categoria,
      roundCurrency((accumulator.get(expense.categoria) ?? 0) + expense.monto)
    );

    return accumulator;
  }, new Map());

  return Array.from(totalsByCategory.entries())
    .map<CategorySpendSummary>(([categoria, total]) => {
      const metadata = categoryCatalog.get(categoria);

      return {
        categoria,
        label: metadata?.label ?? categoria,
        icon: metadata?.icon ?? "✨",
        total,
        percentage: gastoTotal > 0 ? roundCurrency((total / gastoTotal) * 100) : 0,
      };
    })
    .sort((firstCategory, secondCategory) => secondCategory.total - firstCategory.total);
}

export function buildDashboardSummary({ household, users, expenses, payments }: DashboardSummaryInput): DashboardMathSummary {
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
  const categorySummary = buildCategorySummary(expenses, gastoTotal);
  const hasPairSetup = users.length === 2;
  const percentages = hasPairSetup ? household.porcentajesDefecto : null;

  const spendingByUser = users.map((user, index) => {
    const totalPagado = totalsByUser.get(user._id) ?? 0;

    if (!hasPairSetup || !percentages) {
      return {
        ...user,
        totalPagado,
        porcentajeResponsabilidad: null,
        montoObjetivo: null,
        saldoNeto: null,
      };
    }

    const porcentajeResponsabilidad = index === 0 ? percentages.user1 : percentages.user2;
    const montoObjetivo = roundCurrency((gastoTotal * porcentajeResponsabilidad) / 100);
    const saldoNeto = roundCurrency(
      totalPagado - montoObjetivo + (paymentsByUser.get(user._id) ?? 0)
    );

    return {
      ...user,
      totalPagado,
      porcentajeResponsabilidad,
      montoObjetivo,
      saldoNeto,
    };
  });

  if (!hasPairSetup || !percentages) {
    return {
      gastoTotal,
      paymentTotal,
      paymentCount: payments.length,
      spendingByUser,
      activeDebt: {
        percentages: null,
        settlement: null,
        message: "La deuda activa se muestra cuando hay exactamente 2 personas en la cucha.",
      },
      categorySummary,
    };
  }

  if (gastoTotal <= 0) {
    return {
      gastoTotal,
      paymentTotal,
      paymentCount: payments.length,
      spendingByUser,
      activeDebt: {
        percentages,
        settlement: null,
        message: "Todavía no hay gastos este mes, así que no hay deuda activa.",
      },
      categorySummary,
    };
  }

  const sortedByBalance = [...spendingByUser].sort(
    (firstUser, secondUser) => (secondUser.saldoNeto ?? 0) - (firstUser.saldoNeto ?? 0)
  );
  const creditor = sortedByBalance[0];
  const debtor = sortedByBalance[sortedByBalance.length - 1];
  const amount = roundCurrency(
    Math.min(creditor.saldoNeto ?? 0, Math.abs(debtor.saldoNeto ?? 0))
  );

  return {
    gastoTotal,
    paymentTotal,
    paymentCount: payments.length,
    spendingByUser,
    activeDebt: amount > 0
      ? {
          percentages,
          settlement: {
            fromUserId: debtor._id,
            fromNombre: debtor.nombre,
            toUserId: creditor._id,
            toNombre: creditor.nombre,
            amount,
          },
          message: `${debtor.nombre} le debe ${formatCurrency(amount)} a ${creditor.nombre}.`,
        }
      : {
          percentages,
          settlement: null,
          message:
            payments.length > 0
              ? "Los pagos cargados dejaron el mes al día con la distribución configurada."
              : "Por ahora están al día con la distribución configurada.",
        },
    categorySummary,
  };
}

export function withUpdatedDashboardSummary(payload: ExpensesDashboardPayload) {
  return {
    ...payload,
    summary: buildDashboardSummary({
      household: payload.household,
      users: payload.users,
      expenses: payload.expenses,
      payments: payload.payments,
    }),
  };
}