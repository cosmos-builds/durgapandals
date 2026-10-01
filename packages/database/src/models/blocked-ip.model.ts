import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const blockedIpSchema = new Schema(
  {
    ip: { type: String, required: true, unique: true },
    reason: {
      type: String,
      enum: ["SPAM_LIKES", "SPAM_SUBMISSIONS", "ABUSE", "SCRAPING", "OTHER"],
      required: true,
      default: "OTHER",
    },
    notes: { type: String },
    blockedBy: { type: String, required: true },
    // null/unset means permanent — only set this for temporary blocks, so a
    // stale lifted-block row doesn't silently keep blocking forever.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

blockedIpSchema.index({ ip: 1 }, { unique: true });

export type BlockedIpDocument = InferSchemaType<typeof blockedIpSchema>;

type BlockedIpModelType = Model<BlockedIpDocument>;
export const BlockedIpModel: BlockedIpModelType =
  (models.BlockedIp as BlockedIpModelType) ?? model<BlockedIpDocument>("BlockedIp", blockedIpSchema);
