// Ubicacion: src/models/Expense.ts
// Modelo de gasto. Cada gasto queda aislado por hogarId y ligado al usuario que lo pago.
import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const expenseSchema = new Schema(
  {
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
    mesLiquidacion: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      index: true,
    },
  },
  {
    collection: "expenses",
    timestamps: true,
  }
);

expenseSchema.index({ hogarId: 1, mesLiquidacion: 1, fecha: -1 });
expenseSchema.index({ hogarId: 1, pagadoPor: 1, mesLiquidacion: 1 });

export interface ExpenseDocument extends InferSchemaType<typeof expenseSchema> {
  _id: Types.ObjectId;
}

export const Expense =
  (models.Expense as Model<ExpenseDocument> | undefined) ||
  model<ExpenseDocument>("Expense", expenseSchema);
