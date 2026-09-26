import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const reactionSchema = new Schema(
  {
    pandalYearId: { type: Schema.Types.ObjectId, ref: "PandalYear", required: true },
    anonymousVisitorId: { type: String, required: true },
    type: { type: String, enum: ["LIKE"], required: true, default: "LIKE" },
  },
  { timestamps: true }
);

// One reaction per visitor per pandal-year — enforced at the database level,
// not just in application code.
reactionSchema.index({ pandalYearId: 1, anonymousVisitorId: 1 }, { unique: true });

export type ReactionDocument = InferSchemaType<typeof reactionSchema>;

// See city.model.ts for why both sides of `??` share one explicit Model<T>.
type ReactionModelType = Model<ReactionDocument>;
export const ReactionModel: ReactionModelType =
  (models.Reaction as ReactionModelType) ?? model<ReactionDocument>("Reaction", reactionSchema);
