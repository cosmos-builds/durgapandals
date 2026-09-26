import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const mediaAssetSchema = new Schema(
  {
    url: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    altText: { type: String },
    caption: { type: String },
  },
  { _id: true }
);

const pandalYearSchema = new Schema(
  {
    pandalId: { type: Schema.Types.ObjectId, ref: "Pandal", required: true },
    year: { type: Number, required: true },

    displayName: { type: String },
    theme: { type: String },
    description: { type: String },

    startDate: { type: Date },
    endDate: { type: Date },
    openingHours: { type: String },

    parkingInfo: { type: String },
    entryInfo: { type: String },
    accessibilityInfo: { type: String },

    coverImage: { type: String },
    photos: { type: [mediaAssetSchema], default: [] },

    categories: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    featured: { type: Boolean, default: false },

    publicationStatus: {
      type: String,
      enum: ["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"],
      required: true,
      default: "DRAFT",
    },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "VERIFIED", "DUPLICATE"],
      required: true,
      default: "UNVERIFIED",
    },
  },
  { timestamps: true }
);

// A pandal has at most one record per festival year.
pandalYearSchema.index({ pandalId: 1, year: 1 }, { unique: true });
pandalYearSchema.index({ pandalId: 1, publicationStatus: 1, featured: 1 });

export type PandalYearDocument = InferSchemaType<typeof pandalYearSchema>;

// See city.model.ts for why both sides of `??` share one explicit Model<T>.
type PandalYearModelType = Model<PandalYearDocument>;
export const PandalYearModel: PandalYearModelType =
  (models.PandalYear as PandalYearModelType) ?? model<PandalYearDocument>("PandalYear", pandalYearSchema);
