import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const contributorSchema = new Schema(
  {
    identifier: { type: String, required: true, unique: true }, // email or phone
    verifiedAt: { type: Date },

    // OTP abuse protection state (spec §16): short expiry, capped attempts,
    // resend cooldown — all enforced server-side, all on this one document.
    otpCodeHash: { type: String },
    otpExpiresAt: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    otpLastSentAt: { type: Date },
  },
  { timestamps: true }
);

export type ContributorDocument = InferSchemaType<typeof contributorSchema>;

// See city.model.ts for why both sides of `??` share one explicit Model<T>.
type ContributorModelType = Model<ContributorDocument>;
export const ContributorModel: ContributorModelType =
  (models.Contributor as ContributorModelType) ?? model<ContributorDocument>("Contributor", contributorSchema);
