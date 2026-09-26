import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const pandalSchema = new Schema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: "City", required: true },
    slug: { type: String, required: true },

    canonicalName: { type: String, required: true },
    alternateNames: { type: [String], default: [] },
    organizerName: { type: String },

    // GeoJSON Point — enables $near / $geoWithin proximity queries used by
    // duplicate detection (packages/deduplication) and the map API.
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    address: { type: String, required: true },
    locality: { type: String, required: true },
    landmark: { type: String },

    publicContact: { type: String },
    instagramUrl: { type: String },
    facebookUrl: { type: String },
    websiteUrl: { type: String },

    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "VERIFIED", "DUPLICATE"],
      required: true,
      default: "UNVERIFIED",
    },
    publicationStatus: {
      type: String,
      enum: ["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"],
      required: true,
      default: "DRAFT",
    },

    mergedIntoPandalId: { type: Schema.Types.ObjectId, ref: "Pandal" },
  },
  { timestamps: true }
);

pandalSchema.index({ cityId: 1, slug: 1 }, { unique: true });
pandalSchema.index({ location: "2dsphere" });
pandalSchema.index({ canonicalName: "text", alternateNames: "text", locality: "text" });

export type PandalDocument = InferSchemaType<typeof pandalSchema>;

// See city.model.ts for why both sides of `??` are annotated with the same
// explicit Model<T> type instead of letting it infer a union.
type PandalModelType = Model<PandalDocument>;
export const PandalModel: PandalModelType =
  (models.Pandal as PandalModelType) ?? model<PandalDocument>("Pandal", pandalSchema);

export function toGeoPoint(latitude: number, longitude: number) {
  return { type: "Point" as const, coordinates: [longitude, latitude] };
}

// `location` is always set by the app (createPandalSchema requires
// latitude/longitude), but the inferred schema type marks the embedded
// object optional and its coordinates as a loose number[]. This is the one
// place that un-does both, instead of repeating a cast at every call site.
export function fromGeoPoint(location: PandalDocument["location"]): { latitude: number; longitude: number } {
  const [longitude, latitude] = location!.coordinates as [number, number];
  return { latitude, longitude };
}
