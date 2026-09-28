import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const citySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    state: { type: String, required: true },
    stateCode: { type: String, required: true },
    countryCode: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    defaultMapZoom: { type: Number, required: true, default: 13 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMING_SOON", "DISABLED"],
      required: true,
      default: "COMING_SOON",
    },
    activeFestivalYear: { type: Number, required: true },
    // MAJOR cities are pinned/pre-listed in the city picker; MINOR ones are
    // reachable only by typing (generalizes past the old Bhopal/Indore-only
    // hardcoded pair to any number of cities — spec §4).
    tier: { type: String, enum: ["MAJOR", "MINOR"], required: true, default: "MINOR" },
  },
  { timestamps: true }
);

// Backs the substring/prefix name search in GET /cities/search — a plain
// index still speeds up the common case (short, indexed-prefix regexes)
// even though it can't help every unanchored substring match.
citySchema.index({ name: 1 });

export type CityDocument = InferSchemaType<typeof citySchema>;

// `models.City` is loosely typed as Model<any>; unioning it directly with
// model()'s concretely-typed return via `??` produces two incompatible
// overloaded call signatures, which surfaces as "This expression is not
// callable" on every query. Annotating both sides of `??` with the same
// explicit Model<CityDocument> type keeps the union from ever forming,
// while `??` still only evaluates model(...) when nothing is registered yet
// (safe across tsx's hot reload, which would otherwise throw on redefinition).
type CityModelType = Model<CityDocument>;
export const CityModel: CityModelType = (models.City as CityModelType) ?? model<CityDocument>("City", citySchema);
