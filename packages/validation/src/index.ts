import { z } from "zod";

export const citySlugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9-]+$/);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const visitTypeSchema = z.enum(["WALKING_DARSHAN", "PARK_AND_VISIT", "DARSHAN_AND_GO"]);

export const createPandalSchema = z.object({
  cityId: z.string().min(1),
  canonicalName: z.string().min(2).max(160),
  alternateNames: z.array(z.string().min(1).max(160)).max(10).default([]),
  organizerName: z.string().max(160).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(3).max(300),
  locality: z.string().min(1).max(120),
  landmark: z.string().max(160).optional(),
  publicContact: z.string().max(80).optional(),
  instagramUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  parkingAvailable: z.boolean().default(false),
  twoWheelerAccessible: z.boolean().default(false),
  fourWheelerAccessible: z.boolean().default(false),
  foodStallsNearby: z.boolean().default(false),
  streetShopsNearby: z.boolean().default(false),
  visitType: visitTypeSchema.default("WALKING_DARSHAN"),
});

// `addedBy` is admin-editable only (never accepted from a public submission,
// which always defaults to PUBLIC_SUBMISSION — spec §1) — kept off
// createPandalSchema and added only here.
export const updatePandalSchema = createPandalSchema.partial().extend({
  id: z.string().min(1),
  addedBy: z.enum(["ADMIN", "ORGANIZER", "PUBLIC_SUBMISSION"]).optional(),
});

export const scheduleEntrySchema = z.object({
  time: z.string().min(1).max(20),
  label: z.string().min(1).max(80),
});

export const pandalYearSchema = z.object({
  pandalId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  displayName: z.string().max(160).optional(),
  theme: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // Free-length, 0..N rows — no fixed template (spec §1).
  schedule: z.array(scheduleEntrySchema).max(10).default([]),
  coverImage: z.string().url().optional(),
  categories: z.array(z.string()).max(10).default([]),
  tags: z.array(z.string()).max(20).default([]),
  featured: z.boolean().default(false),
});

export const citySchema = z.object({
  name: z.string().min(2).max(80),
  slug: citySlugSchema,
  state: z.string().min(2).max(80),
  stateCode: z.string().min(2).max(10),
  countryCode: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  defaultMapZoom: z.number().min(1).max(20).default(13),
  status: z.enum(["ACTIVE", "COMING_SOON", "DISABLED"]).default("COMING_SOON"),
  activeFestivalYear: z.number().int().min(2000).max(2100),
  // MAJOR cities are pinned in the city picker; MINOR ones are search-only
  // (spec §4 — generalizes past the old Bhopal/Indore-only hardcoded pair).
  tier: z.enum(["MAJOR", "MINOR"]).default("MINOR"),
});

export const citySearchQuerySchema = z.object({
  q: z.string().min(2).max(80),
});

// Body shape of an unresolved (Nominatim-sourced) city search result —
// exactly what `POST /cities/resolve` needs to find-or-create a City row
// outside the admin panel.
export const cityResolveSchema = z.object({
  name: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const submissionTypeSchema = z.enum([
  "NEW_PANDAL",
  "UPDATE_PANDAL",
  "NEW_YEAR",
  "CORRECTION",
]);

export const createSubmissionSchema = z.object({
  cityId: z.string().min(1),
  type: submissionTypeSchema,
  possiblePandalId: z.string().optional(),
  submittedData: z.record(z.unknown()),
  contributorContact: z
    .string()
    .min(3)
    .max(120)
    .describe("email or phone used to reach the contributor"),
  // Honeypot — a real visitor never sees or fills this field (hidden via
  // CSS on the form), but most naive scripted/bot submissions fill every
  // input they can find. Any non-empty value here is treated as spam.
  website: z.string().max(200).optional(),
});

export const verificationRequestSchema = z.object({
  identifier: z.string().min(3).max(120),
});

export const verificationConfirmSchema = z.object({
  identifier: z.string().min(3).max(120),
  code: z.string().length(6),
});

export const reactionToggleSchema = z.object({
  pandalYearId: z.string().min(1),
  anonymousVisitorId: z.string().min(8).max(128),
});

export type CreatePandalInput = z.infer<typeof createPandalSchema>;
export type UpdatePandalInput = z.infer<typeof updatePandalSchema>;
export type PandalYearInput = z.infer<typeof pandalYearSchema>;
export type CityInput = z.infer<typeof citySchema>;
export type CityResolveInput = z.infer<typeof cityResolveSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type ReactionToggleInput = z.infer<typeof reactionToggleSchema>;
