import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

import { TRIP_EXPENSE_CATEGORY_VALUES } from "@/lib/trip-expense-categories";

const tripExpenseSchema = new Schema(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    hogarId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    descripcion: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    monto: {
      type: Number,
      required: true,
      min: 0,
    },
    categoria: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      validate: {
        validator: (value: string) => TRIP_EXPENSE_CATEGORY_VALUES.includes(value as any),
        message: "La categoría no es válida.",
      },
    },
    ciudad: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    fecha: {
      type: Date,
      required: true,
      default: Date.now,
    },
    pagadoPor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    collection: "trip_expenses",
    timestamps: true,
  }
);

tripExpenseSchema.index({ tripId: 1, fecha: -1 });
tripExpenseSchema.index({ tripId: 1, pagadoPor: 1 });
tripExpenseSchema.index({ hogarId: 1, tripId: 1 });

export interface TripExpenseDocument extends InferSchemaType<typeof tripExpenseSchema> {
  _id: Types.ObjectId;
}

export const TripExpense =
  (models.TripExpense as Model<TripExpenseDocument> | undefined) ||
  model<TripExpenseDocument>("TripExpense", tripExpenseSchema);
