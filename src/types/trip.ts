import type { TripExpenseCategoryValue } from "@/lib/trip-expense-categories";
import type { HouseholdUserOption } from "@/types/expense";

export type { HouseholdUserOption };

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

export interface TripExpenseSummary {
  gastoTotal: number;
  totalesPorUsuario: Array<{
    userId: string;
    totalPagado: number;
  }>;
  balancePorUsuario: Record<string, number>;
}

export interface TripDashboardPayload {
  trip: TripDetail;
  currentUserId: string;
  users: HouseholdUserOption[];
  expenses: TripExpenseListItem[];
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
