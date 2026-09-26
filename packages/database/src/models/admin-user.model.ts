import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN"], required: true, default: "ADMIN" },
  },
  { timestamps: true }
);

export type AdminUserDocument = InferSchemaType<typeof adminUserSchema>;

// See city.model.ts for why both sides of `??` share one explicit Model<T>.
type AdminUserModelType = Model<AdminUserDocument>;
export const AdminUserModel: AdminUserModelType =
  (models.AdminUser as AdminUserModelType) ?? model<AdminUserDocument>("AdminUser", adminUserSchema);
