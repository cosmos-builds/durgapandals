import type { FastifyPluginAsync } from "fastify";
import { CloudinaryProvider } from "./cloudinary-provider";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo, not for a dumped RAW/video
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Public, unauthenticated (a contributor adding a pandal has no account) —
// the resolution cap lives in CloudinaryProvider.upload (a "limit" crop
// transform applied at upload time, so it's enforced regardless of what any
// client sends), this route's own job is just type/size gatekeeping and
// spam control before that.
export const mediaRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/multipart"), {
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  });

  await app.register(import("@fastify/rate-limit"), {
    max: 20,
    timeWindow: "10 minutes",
  });

  const provider = new CloudinaryProvider({
    cloudName: app.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: app.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: app.env.CLOUDINARY_API_SECRET ?? "",
  });

  app.post("/upload", async (request, reply) => {
    let file;
    try {
      file = await request.file();
    } catch {
      return reply.code(413).send({ error: `Image is too large — max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` });
    }
    if (!file) return reply.code(400).send({ error: "No file provided" });

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return reply.code(400).send({ error: "Only JPEG, PNG, or WebP images are supported" });
    }

    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      return reply.code(413).send({ error: `Image is too large — max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` });
    }

    try {
      const result = await provider.upload(buffer, {
        folder: "durgapandals/pandal-photos",
        filename: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Could not process that image — try a different photo." });
    }
  });
};
