// Ubicacion: src/models/History.ts
// Modelo de cierre mensual por hogar. Guarda el resumen consolidado del periodo liquidado.
import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const balanceByUserSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalPagado: {
      type: Number,
      required: true,
      min: 0,
    },
    saldoNeto: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const settlementSchema = new Schema(
  {
    desde: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    hacia: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    monto: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const historySummarySchema = new Schema(
  {
    balances: {
      type: [balanceByUserSchema],
      default: [],
    },
    transferenciaSugerida: {
      type: settlementSchema,
      default: undefined,
    },
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    hogarId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    mesLiquidacion: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    gastoTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPagos: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cantidadPagos: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deudaPendiente: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    resumenSaldos: {
      type: historySummarySchema,
      required: true,
    },
    cerradoEl: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: "history",
    timestamps: true,
  }
);

historySchema.index({ hogarId: 1, mesLiquidacion: 1 }, { unique: true });

export interface HistoryDocument extends InferSchemaType<typeof historySchema> {
  _id: Types.ObjectId;
}

export const History =
  (models.History as Model<HistoryDocument> | undefined) ||
  model<HistoryDocument>("History", historySchema);