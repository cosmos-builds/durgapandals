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
});

export const updatePandalSchema = createPandalSchema.partial().extend({
  id: z.string().min(1),
});

export const pandalYearSchema = z.object({
  pandalId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  displayName: z.string().max(160).optional(),
  theme: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  openingHours: z.string().max(200).optional(),
  parkingInfo: z.string().max(500).optional(),
  entryInfo: z.string().max(500).optional(),
  accessibilityInfo: z.string().max(500).optional(),
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
    .describe("email or phone used for OTP verification"),
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
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type ReactionToggleInput = z.infer<typeof reactionToggleSchema>;
