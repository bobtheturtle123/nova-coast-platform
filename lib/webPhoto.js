// 2048px web/MLS photo generation — the derived "web-ready" version of a photo.
//
// Real-estate photos are delivered at full resolution for print, but MLS/web use
// wants a 2048px JPEG. We generate that version ONCE (in the generate-web-photos
// cron), store it in R2 next to the original, and then reuse it for every gallery
// download and every ZIP build — instead of running Sharp on every request. This
// keeps Fluid Active CPU flat and lets photo downloads redirect straight to R2.

import sharp from "sharp";

export const WEB_PHOTO_MAX_PX  = 2048;
export const WEB_PHOTO_QUALITY = 82;

// Derive the R2 key for a photo's web/MLS version from its original key.
// Mirrors webVideoKey(): "<base>-mls.jpg".
export function webPhotoKey(originalKey) {
  const base = originalKey.replace(/\.[^./]+$/, "");
  return `${base}-mls.jpg`;
}

// Resize an image buffer to a 2048px progressive JPEG. Resolves { buffer, bytes }.
export async function generateWebPhoto(inputBuffer) {
  const buffer = await sharp(inputBuffer)
    .resize({ width: WEB_PHOTO_MAX_PX, withoutEnlargement: true })
    .jpeg({ quality: WEB_PHOTO_QUALITY, progressive: true })
    .toBuffer();
  return { buffer, bytes: buffer.length };
}
