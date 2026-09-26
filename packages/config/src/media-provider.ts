// Media storage is a provider boundary (spec §27, §31.5): start on
// Cloudinary's free tier for built-in thumbnails/responsive variants, move
// to R2 later without touching calling code.
export interface UploadResult {
  url: string;
  width?: number;
  height?: number;
}

export interface MediaProvider {
  upload(fileBuffer: Buffer, options: { folder: string; filename: string }): Promise<UploadResult>;
  delete(url: string): Promise<void>;
  thumbnailUrl(url: string, options: { width: number; height?: number }): string;
}
