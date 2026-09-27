import { v2 as cloudinary } from "cloudinary";
import type { MediaProvider, UploadResult } from "@durgapandals/config";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// The only MediaProvider implementation today (packages/config just holds
// the interface, spec §27/§31.5 — this is the concrete Cloudinary adapter
// so the SDK dependency stays out of the shared config package).
export class CloudinaryProvider implements MediaProvider {
  constructor(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload(fileBuffer: Buffer, options: { folder: string; filename: string }): Promise<UploadResult> {
    const result = await new Promise<{ secure_url: string; width: number; height: number }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.filename,
          resource_type: "image",
          // Photos only ever need to be as big as they're actually
          // displayed at (spec ask: "only get images in the resolution we
          // support") — "limit" downsizes anything larger and never
          // upscales a smaller image, applied once at upload time rather
          // than trusting every caller to request the right transform.
          transformation: [{ width: 2400, height: 2400, crop: "limit" }],
        },
        (error, uploadResult) => {
          if (error || !uploadResult) return reject(error ?? new Error("Upload failed"));
          resolve(uploadResult as { secure_url: string; width: number; height: number });
        }
      );
      stream.end(fileBuffer);
    });

    return { url: result.secure_url, width: result.width, height: result.height };
  }

  async delete(url: string): Promise<void> {
    const publicId = extractPublicId(url);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  }

  thumbnailUrl(url: string, options: { width: number; height?: number }): string {
    const publicId = extractPublicId(url);
    if (!publicId) return url;
    return cloudinary.url(publicId, {
      width: options.width,
      height: options.height,
      crop: "fill",
      secure: true,
    });
  }
}

// Cloudinary URLs look like
// https://res.cloudinary.com/<cloud>/image/upload/v<version>/<folder>/<public_id>.<ext>
// — the public_id (needed for delete/thumbnailUrl) is everything between
// the version segment and the file extension.
function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match?.[1] ?? null;
}
