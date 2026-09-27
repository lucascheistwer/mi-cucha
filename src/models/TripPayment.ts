import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const tripPaymentSchema = new Schema(
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
      set: (value: number) => Math.round(value),
    },
    fecha: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: "trip_payments",
    timestamps: true,
    validateBeforeSave: true,
  }
);

tripPaymentSchema.pre("validate", function validateUsers() {
  if (this.fromUserId?.toString() === this.toUserId?.toString()) {
    this.invalidate("toUserId", "El pago debe registrarse entre dos personas distintas.");
  }
});

tripPaymentSchema.index({ tripId: 1, fecha: -1 });
tripPaymentSchema.index({ tripId: 1, fromUserId: 1, toUserId: 1 });

export interface TripPaymentDocument extends InferSchemaType<typeof tripPaymentSchema> {
  _id: Types.ObjectId;
}

const existingTripPaymentModel = models.TripPayment as Model<TripPaymentDocument> | undefined;

if (existingTripPaymentModel && process.env.NODE_ENV !== "production") {
  delete models.TripPayment;
}

export const TripPayment =
  (models.TripPayment as Model<TripPaymentDocument> | undefined) ||
  model<TripPaymentDocument>("TripPayment", tripPaymentSchema);
