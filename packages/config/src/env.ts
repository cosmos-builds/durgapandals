import { z } from "zod";

// Every environment-driven value the app needs, validated at boot so a
// missing secret fails fast instead of surfacing as a runtime 500 later.
export const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(16),

  MEDIA_PROVIDER: z.enum(["cloudinary", "r2"]).default("cloudinary"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),

  VERIFICATION_PROVIDER: z.enum(["resend"]).default("resend"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_ADDRESS: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  MAP_TILES_URL: z.string().url().default("https://tiles.openfreemap.org/styles/liberty"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}
