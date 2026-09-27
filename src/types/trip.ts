import type { TripExpenseCategoryValue } from "@/lib/trip-expense-categories";
import type { ActiveDebtSummary, HouseholdUserOption } from "@/types/expense";

export type { ActiveDebtSummary, HouseholdUserOption };

export interface Trip {
  _id: string;
  hogarId: string;
  nombre: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  ciudades: string[];
  estado: "activo" | "finalizado";
  creadoPor: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripDetail extends Trip {
  creadoPorDetalle: HouseholdUserOption | null;
}

export interface TripExpense {
  _id: string;
  tripId: string;
  hogarId: string;
  descripcion: string;
  monto: number;
  categoria: string;
  ciudad: string;
  fecha: string;
  pagadoPor: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripExpenseListItem extends TripExpense {
  pagadoPorDetalle: HouseholdUserOption | null;
}

export interface TripPayment {
  _id: string;
  tripId: string;
  hogarId: string;
  fromUserId: string;
  toUserId: string;
  monto: number;
  fecha: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripPaymentListItem extends TripPayment {
  fromUser: HouseholdUserOption | null;
  toUser: HouseholdUserOption | null;
}

export interface TripExpenseSummary {
  gastoTotal: number;
  paymentTotal: number;
  paymentCount: number;
  totalesPorUsuario: Array<{
    userId: string;
    totalPagado: number;
  }>;
  balancePorUsuario: Record<string, number>;
  activeDebt: ActiveDebtSummary;
}

export interface TripDashboardPayload {
  trip: TripDetail;
  currentUserId: string;
  users: HouseholdUserOption[];
  expenses: TripExpenseListItem[];
  payments: TripPaymentListItem[];
  summary: TripExpenseSummary;
  porcentajesDefecto?: {
    user1: number;
    user2: number;
  };
}

export type CreateTripInput = Omit<
  Trip,
  "_id" | "estado" | "createdAt" | "updatedAt"
>;

export type CreateTripExpenseInput = Omit<TripExpense, "_id" | "createdAt" | "updatedAt">;

export type CreateTripPaymentInput = Omit<TripPayment, "_id" | "createdAt" | "updatedAt">;
