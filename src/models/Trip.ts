import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const tripSchema = new Schema(
  {
    hogarId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    fechaInicio: {
      type: Date,
      required: true,
    },
    fechaFin: {
      type: Date,
      required: true,
    },
    ciudades: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (value: string[]) => {
          return Array.isArray(value) && value.every((city) => city.length > 0);
        },
        message: "Las ciudades deben ser válidas y no estar vacías.",
      },
    },
    estado: {
      type: String,
      enum: ["activo", "finalizado"],
      default: "activo",
    },
    creadoPor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "trips",
    timestamps: true,
  }
);

tripSchema.index({ hogarId: 1, estado: 1 });
tripSchema.index({ hogarId: 1, creadoPor: 1 });

export interface TripDocument extends InferSchemaType<typeof tripSchema> {
  _id: Types.ObjectId;
}

export const Trip =
  (models.Trip as Model<TripDocument> | undefined) ||
  model<TripDocument>("Trip", tripSchema);
