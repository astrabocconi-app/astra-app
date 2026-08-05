// Image optimization for uploaded assets.
//
// SERVER-ONLY (uses sharp). Uploads are stored as raw bytes in ImageAsset and
// served straight back by /api/media/:id — there's no CDN transform in front of
// them, so whatever we store is exactly what every client downloads. A 4 MB
// phone-camera PNG cover therefore costs 4 MB on every cold load. We normalize
// on the way in instead: downscale to display size and re-encode.

import sharp from "sharp";

/** Covers render at ~2:1 or 16:9 full-bleed; 1600px wide covers 2x retina. */
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;

const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;

export type OptimizedImage = {
  /** Plain Uint8Array — matches what Prisma's Bytes column accepts. */
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
};

/** sharp hands back Buffer<ArrayBufferLike>; Prisma Bytes wants ArrayBuffer-backed. */
function toBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buf);
}

/**
 * Downscale to fit MAX_WIDTH/MAX_HEIGHT (never upscales) and re-encode.
 *
 * Images with an alpha channel become WebP so transparency survives; opaque
 * ones become JPEG. Both are safe on every target: WebP is supported by iOS 14+,
 * Android 4.2+ (we ship minSdk 24) and all modern browsers.
 *
 * GIFs are passed through untouched — re-encoding would drop the animation.
 */
export async function optimizeImage(input: Buffer, mimeType: string): Promise<OptimizedImage> {
  if (mimeType === "image/gif") return { data: toBytes(input), mimeType };

  const pipeline = sharp(input, { failOn: "none" })
    .rotate() // honour EXIF orientation before we strip the metadata
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    });

  const { hasAlpha } = await sharp(input, { failOn: "none" }).metadata();

  if (hasAlpha) {
    return {
      data: toBytes(await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()),
      mimeType: "image/webp",
    };
  }
  return {
    data: toBytes(await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()),
    mimeType: "image/jpeg",
  };
}
