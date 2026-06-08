// Ubicacion: src/models/Household.ts
// Modelo del hogar. Agrupa usuarios, gastos e historiales por hogarId.
import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { EXPENSE_CATEGORY_VALUES, isExpenseCategoryValue } from "@/lib/expense-categories";
import { getMonthKey } from "@/lib/date-helpers";

const defaultPercentagesSchema = new Schema(
  {
    user1: { type: Number, required: true, min: 0, max: 100, default: 50 },
    user2: { type: Number, required: true, min: 0, max: 100, default: 50 },
  },
  { _id: false }
);

const householdSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    porcentajesDefecto: {
      type: defaultPercentagesSchema,
      required: true,
      default: () => ({ user1: 50, user2: 50 }),
      validate: {
        validator: (value: { user1: number; user2: number }) => value.user1 + value.user2 === 100,
        message: "Los porcentajes por defecto deben sumar 100.",
      },
    },
    categoriasHabilitadas: {
      type: [String],
      required: true,
      default: () => [...EXPENSE_CATEGORY_VALUES],
      validate: {
        validator: (value: string[]) => {
          if (!Array.isArray(value) || value.length === 0) {
            return false;
          }

          const uniqueValues = new Set(value);

          return uniqueValues.size === value.length && value.every(isExpenseCategoryValue);
        },
        message: "Las categorías habilitadas deben ser válidas y no repetirse.",
      },
    },
    codigoInvitacion: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 6,
      maxlength: 12,
    },
    mesActivo: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      default: () => getMonthKey(new Date()),
    },
  },
  {
    collection: "households",
    timestamps: true,
  }
);

export type HouseholdDocument = InferSchemaType<typeof householdSchema>;

export const Household =
  (models.Household as Model<HouseholdDocument> | undefined) ||
  model<HouseholdDocument>("Household", householdSchema);