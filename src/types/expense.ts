import type { ExpenseCategoryValue } from "@/lib/expense-categories";

export interface Expense {
  _id: string;
  hogarId: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  pagadoPor: string;
  mesLiquidacion: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateExpenseInput = Omit<Expense, "_id" | "createdAt" | "updatedAt">;

export interface Payment {
  _id: string;
  hogarId: string;
  fromUserId: string;
  toUserId: string;
  monto: number;
  fecha: string;
  mesLiquidacion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListItem extends Payment {
  fromUser: HouseholdUserOption | null;
  toUser: HouseholdUserOption | null;
}

export interface ExpenseSummary {
  gastoTotal: number;
  totalesPorUsuario: Array<{
    userId: string;
    totalPagado: number;
  }>;
  balancePorUsuario: Record<string, number>;
}

export interface HouseholdUserOption {
  _id: string;
  nombre: string;
  username: string;
}

export interface HouseholdSummary {
  _id: string;
  nombre: string;
  inviteCode: string;
  activeMonth: string;
  categoriasHabilitadas: ExpenseCategoryValue[];
  porcentajesDefecto: {
    user1: number;
    user2: number;
  };
}

export interface UserSpendSummary extends HouseholdUserOption {
  totalPagado: number;
  porcentajeResponsabilidad: number | null;
  montoObjetivo: number | null;
  saldoNeto: number | null;
}

export interface ActiveDebtSettlement {
  fromUserId: string;
  fromNombre: string;
  toUserId: string;
  toNombre: string;
  amount: number;
}

export interface ActiveDebtSummary {
  percentages: {
    user1: number;
    user2: number;
  } | null;
  settlement: ActiveDebtSettlement | null;
  message: string;
}

export interface CategorySpendSummary {
  categoria: string;
  label: string;
  icon: string;
  total: number;
  percentage: number;
}

export interface DashboardMathSummary {
  gastoTotal: number;
  paymentTotal: number;
  paymentCount: number;
  spendingByUser: UserSpendSummary[];
  activeDebt: ActiveDebtSummary;
  categorySummary: CategorySpendSummary[];
}

export interface AvailableMonthSummary {
  monthKey: string;
  isCurrent: boolean;
  isFinalized: boolean;
}

export interface SelectedMonthState {
  activeMonth: string;
  selectedMonth: string;
  isCurrent: boolean;
  isFinalized: boolean;
  canFinalize: boolean;
  closedAt: string | null;
}

export interface ExpenseListItem extends Expense {
  pagadoPorDetalle: HouseholdUserOption | null;
}

export interface ExpensesDashboardPayload {
  currentMonth: string;
  activeMonth: string;
  currentUserId: string;
  monthState: SelectedMonthState;
  availableMonths: AvailableMonthSummary[];
  household: HouseholdSummary;
  summary: DashboardMathSummary;
  users: HouseholdUserOption[];
  expenses: ExpenseListItem[];
  payments: PaymentListItem[];
}
