// Ubicacion: src/models/User.ts
// Modelo de usuario. Cada usuario pertenece a un unico hogar mediante hogarId.
import {
  model,
  models,
  Schema,
  Types,
  type InferSchemaType,
  type Model,
} from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9._-]{3,30}$/,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    hogarId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
  },
  {
    collection: "users",
    timestamps: true,
  }
);

export interface UserDocument extends InferSchemaType<typeof userSchema> {
  _id: Types.ObjectId;
}

const existingUserModel = models.User as Model<UserDocument> | undefined;

if (existingUserModel && !existingUserModel.schema.path("passwordHash")) {
  delete models.User;
}

export const User =
  (models.User as Model<UserDocument> | undefined) ||
  model<UserDocument>("User", userSchema);