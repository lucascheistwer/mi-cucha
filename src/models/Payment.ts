import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const paymentSchema = new Schema(
  {
    hogarId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    monto: {
      type: Number,
      required: true,
      min: 0,
    },
    fecha: {
      type: Date,
      required: true,
      default: Date.now,
    },
    mesLiquidacion: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
      index: true,
    },
  },
  {
    collection: "payments",
    timestamps: true,
    validateBeforeSave: true,
  }
);

paymentSchema.pre("validate", function validateUsers() {
  if (this.fromUserId?.toString() === this.toUserId?.toString()) {
    this.invalidate("toUserId", "El pago debe registrarse entre dos personas distintas.");
  }
});

paymentSchema.index({ hogarId: 1, mesLiquidacion: 1, fecha: -1 });
paymentSchema.index({ hogarId: 1, fromUserId: 1, toUserId: 1, mesLiquidacion: 1 });

export interface PaymentDocument extends InferSchemaType<typeof paymentSchema> {
  _id: Types.ObjectId;
}

const existingPaymentModel = models.Payment as Model<PaymentDocument> | undefined;

if (existingPaymentModel && process.env.NODE_ENV !== "production") {
  delete models.Payment;
}

export const Payment =
  (models.Payment as Model<PaymentDocument> | undefined) ||
  model<PaymentDocument>("Payment", paymentSchema);