import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const duplicateCandidateSchema = new Schema(
  {
    pandalId: { type: Schema.Types.ObjectId, ref: "Pandal", required: true },
    score: { type: Number, required: true },
    reasons: { type: [String], default: [] },
    distanceMeters: { type: Number },
  },
  { _id: false }
);

const submissionSchema = new Schema(
  {
    cityId: { type: Schema.Types.ObjectId, ref: "City", required: true },

    type: {
      type: String,
      enum: ["NEW_PANDAL", "UPDATE_PANDAL", "NEW_YEAR", "CORRECTION"],
      required: true,
    },

    possiblePandalId: { type: Schema.Types.ObjectId, ref: "Pandal" },
    contributorId: { type: Schema.Types.ObjectId, ref: "Contributor" },

    submittedData: { type: Schema.Types.Mixed, required: true },

    // Straight-line distance (meters) between the submitted lat/lng and the
    // target city's own center, computed once at creation time — surfaced
    // on the admin review card so a mis-attributed submission (wrong city
    // silently carried over from whatever page the contributor started on,
    // while the pin/address itself was dragged somewhere else entirely) is
    // visible *before* approval instead of only discoverable after, by a
    // pandal that mysteriously never shows up on the map it was approved
    // into. Undefined when there's no coordinate to check against (e.g. a
    // CORRECTION submission, which only ever carries a note).
    cityDistanceMeters: { type: Number },

    // Recorded for admin triage only ("who keeps submitting from this IP")
    // — never used as an authorization boundary on its own.
    submitterIp: { type: String },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "MERGED", "REJECTED"],
      required: true,
      default: "PENDING",
    },

    duplicateCandidates: { type: [duplicateCandidateSchema], default: [] },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

submissionSchema.index({ status: 1, cityId: 1, createdAt: -1 });

export type SubmissionDocument = InferSchemaType<typeof submissionSchema>;

// See city.model.ts for why both sides of `??` share one explicit Model<T>.
type SubmissionModelType = Model<SubmissionDocument>;
export const SubmissionModel: SubmissionModelType =
  (models.PandalSubmission as SubmissionModelType) ??
  model<SubmissionDocument>("PandalSubmission", submissionSchema);
