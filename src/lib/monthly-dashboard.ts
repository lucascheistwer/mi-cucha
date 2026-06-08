import { buildDashboardSummary } from "@/lib/dashboard-summary";
import { EXPENSE_CATEGORY_VALUES, isExpenseCategoryValue } from "@/lib/expense-categories";
import { getMonthKey } from "@/lib/date-helpers";
import { Expense } from "@/models/Expense";
import { History } from "@/models/History";
import { Household } from "@/models/Household";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import type {
  AvailableMonthSummary,
  ExpenseListItem,
  ExpensesDashboardPayload,
  HouseholdSummary,
  PaymentListItem,
} from "@/types/expense";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type DashboardPayloadResult =
  | { ok: true; payload: ExpensesDashboardPayload }
  | { ok: false; status: number; error: string };

function normalizeEnabledCategories(value: string[] | undefined) {
  const normalizedValues = value?.filter(isExpenseCategoryValue) ?? [];

  return normalizedValues.length > 0 ? normalizedValues : [...EXPENSE_CATEGORY_VALUES];
}

function sortMonthKeysDesc(firstMonth: string, secondMonth: string) {
  return secondMonth.localeCompare(firstMonth);
}

export function isValidMonthKey(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_KEY_PATTERN.test(value);
}

export function normalizeRequestedMonth(value: string | null | undefined, fallbackMonth: string) {
  if (!value) {
    return fallbackMonth;
  }

  return isValidMonthKey(value) ? value : null;
}

function mapHousehold(household: {
  _id: { toString(): string };
  nombre: string;
  codigoInvitacion: string;
  mesActivo?: string;
  categoriasHabilitadas?: string[];
  porcentajesDefecto: { user1: number; user2: number };
}): HouseholdSummary {
  const activeMonth = household.mesActivo && isValidMonthKey(household.mesActivo)
    ? household.mesActivo
    : getMonthKey(new Date());

  return {
    _id: household._id.toString(),
    nombre: household.nombre,
    inviteCode: household.codigoInvitacion,
    activeMonth,
    categoriasHabilitadas: normalizeEnabledCategories(household.categoriasHabilitadas),
    porcentajesDefecto: {
      user1: household.porcentajesDefecto.user1,
      user2: household.porcentajesDefecto.user2,
    },
  };
}

function mapExpenses(
  expenses: Array<{
    _id: { toString(): string };
    hogarId: { toString(): string };
    descripcion: string;
    monto: number;
    categoria: string;
    fecha: Date;
    pagadoPor: { toString(): string };
    mesLiquidacion: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
  userMap: Map<string, { _id: string; nombre: string; username: string }>
): ExpenseListItem[] {
  return expenses.map((expense) => ({
    _id: expense._id.toString(),
    hogarId: expense.hogarId.toString(),
    descripcion: expense.descripcion,
    monto: expense.monto,
    categoria: expense.categoria,
    fecha: expense.fecha.toISOString(),
    pagadoPor: expense.pagadoPor.toString(),
    mesLiquidacion: expense.mesLiquidacion,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    pagadoPorDetalle: userMap.get(expense.pagadoPor.toString()) ?? null,
  }));
}

function mapPayments(
  payments: Array<{
    _id: { toString(): string };
    hogarId: { toString(): string };
    fromUserId: { toString(): string };
    toUserId: { toString(): string };
    monto: number;
    fecha: Date;
    mesLiquidacion: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
  userMap: Map<string, { _id: string; nombre: string; username: string }>
): PaymentListItem[] {
  return payments.map((payment) => ({
    _id: payment._id.toString(),
    hogarId: payment.hogarId.toString(),
    fromUserId: payment.fromUserId.toString(),
    toUserId: payment.toUserId.toString(),
    monto: payment.monto,
    fecha: payment.fecha.toISOString(),
    mesLiquidacion: payment.mesLiquidacion,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    fromUser: userMap.get(payment.fromUserId.toString()) ?? null,
    toUser: userMap.get(payment.toUserId.toString()) ?? null,
  }));
}

export async function buildMonthlyDashboardPayload(input: {
  hogarId: string;
  currentUserId: string;
  requestedMonth?: string | null;
}): Promise<DashboardPayloadResult> {
  const household = await Household.findById(input.hogarId)
    .select("_id nombre codigoInvitacion mesActivo porcentajesDefecto categoriasHabilitadas")
    .lean();

  if (!household) {
    return {
      ok: false,
      status: 404,
      error: "No encontramos tu cucha actual.",
    };
  }

  const mappedHousehold = mapHousehold(household);
  const selectedMonth = normalizeRequestedMonth(input.requestedMonth, mappedHousehold.activeMonth);

  if (!selectedMonth) {
    return {
      ok: false,
      status: 400,
      error: "El mesLiquidacion debe tener formato YYYY-MM.",
    };
  }

  const [users, expenses, payments, histories] = await Promise.all([
    User.find({ hogarId: input.hogarId }).select("_id nombre username").sort({ nombre: 1 }).lean(),
    Expense.find({ hogarId: input.hogarId, mesLiquidacion: selectedMonth })
      .sort({ fecha: -1, createdAt: -1 })
      .lean(),
    Payment.find({ hogarId: input.hogarId, mesLiquidacion: selectedMonth })
      .sort({ fecha: -1, createdAt: -1 })
      .lean(),
    History.find({ hogarId: input.hogarId })
      .select("mesLiquidacion cerradoEl")
      .sort({ mesLiquidacion: -1 })
      .lean(),
  ]);

  const userMap = new Map(
    users.map((user) => [
      user._id.toString(),
      {
        _id: user._id.toString(),
        nombre: user.nombre,
        username: user.username,
      },
    ])
  );

  const mappedUsers = Array.from(userMap.values());
  const mappedExpenses = mapExpenses(expenses, userMap);
  const mappedPayments = mapPayments(payments, userMap);
  const summary = buildDashboardSummary({
    household: mappedHousehold,
    users: mappedUsers,
    expenses: mappedExpenses,
    payments: mappedPayments,
  });

  const historyByMonth = new Map(
    histories.map((history) => [history.mesLiquidacion, history])
  );
  const monthSet = new Set<string>([
    mappedHousehold.activeMonth,
    selectedMonth,
    ...histories.map((history) => history.mesLiquidacion),
  ]);
  const availableMonths = Array.from(monthSet)
    .sort(sortMonthKeysDesc)
    .map<AvailableMonthSummary>((monthKey) => ({
      monthKey,
      isCurrent: monthKey === mappedHousehold.activeMonth,
      isFinalized: historyByMonth.has(monthKey),
    }));

  const currentHistory = historyByMonth.get(selectedMonth);

  return {
    ok: true,
    payload: {
      currentMonth: selectedMonth,
      activeMonth: mappedHousehold.activeMonth,
      currentUserId: input.currentUserId,
      monthState: {
        activeMonth: mappedHousehold.activeMonth,
        selectedMonth,
        isCurrent: selectedMonth === mappedHousehold.activeMonth,
        isFinalized: Boolean(currentHistory),
        canFinalize: selectedMonth === mappedHousehold.activeMonth,
        closedAt: currentHistory?.cerradoEl?.toISOString() ?? null,
      },
      availableMonths,
      household: mappedHousehold,
      summary,
      users: mappedUsers,
      expenses: mappedExpenses,
      payments: mappedPayments,
    },
  };
}

export async function syncHistorySnapshot(input: {
  hogarId: string;
  monthKey: string;
  payload: ExpensesDashboardPayload;
  ensureExists?: boolean;
}) {
  const shouldUpsert = input.ensureExists ?? false;

  if (!shouldUpsert) {
    const existingHistory = await History.exists({
      hogarId: input.hogarId,
      mesLiquidacion: input.monthKey,
    });

    if (!existingHistory) {
      return null;
    }
  }

  return History.findOneAndUpdate(
    {
      hogarId: input.hogarId,
      mesLiquidacion: input.monthKey,
    },
    {
      $set: {
        gastoTotal: input.payload.summary.gastoTotal,
        totalPagos: input.payload.summary.paymentTotal,
        cantidadPagos: input.payload.summary.paymentCount,
        deudaPendiente: input.payload.summary.activeDebt.settlement?.amount ?? 0,
        resumenSaldos: {
          balances: input.payload.summary.spendingByUser.map((user) => ({
            userId: user._id,
            totalPagado: user.totalPagado,
            saldoNeto: user.saldoNeto ?? 0,
          })),
          transferenciaSugerida: input.payload.summary.activeDebt.settlement
            ? {
                desde: input.payload.summary.activeDebt.settlement.fromUserId,
                hacia: input.payload.summary.activeDebt.settlement.toUserId,
                monto: input.payload.summary.activeDebt.settlement.amount,
              }
            : undefined,
        },
      },
      $setOnInsert: {
        cerradoEl: new Date(),
      },
    },
    {
      upsert: shouldUpsert,
      returnDocument: "after",
      runValidators: true,
    }
  );
}