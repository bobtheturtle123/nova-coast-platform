// 2048px web/MLS photo generation — the derived "web-ready" version of a photo.
//
// Real-estate photos are delivered at full resolution for print, but MLS/web use
// wants a 2048px JPEG. We generate that version ONCE (in the generate-web-photos
// cron), store it in R2 next to the original, and then reuse it for every gallery
// download and every ZIP build — instead of running Sharp on every request. This
// keeps Fluid Active CPU flat and lets photo downloads redirect straight to R2.
//
// This module also holds the single source of truth for a gallery's Web Ready
// generation STATE, used by the generator (what to (re)process), the ZIP gate
// (don't build until every required derivative exists), and the tenant-facing
// "ready to deliver" status. Keep those predicates here so the cron, the enqueue
// gate, and the completion guard never drift apart.

import { isVideo, isWebSized } from "@/lib/retention";

export const WEB_PHOTO_MAX_PX  = 2048;
export const WEB_PHOTO_QUALITY = 82;

// How many times the generator will attempt a single photo before giving up. A
// photo that fails this many times is treated as "resolved" (won't block the ZIP
// forever) — its Web Ready entry is simply omitted, exactly as it is today.
export const MAX_WEB_ATTEMPTS = 3;

// Derive the R2 key for a photo's web/MLS version from its original key.
// Mirrors webVideoKey(): "<base>-mls.jpg".
export function webPhotoKey(originalKey) {
  const base = originalKey.replace(/\.[^./]+$/, "");
  return `${base}-mls.jpg`;
}

// Eligible = a delivered full-resolution photo that SHOULD have a 2048px Web
// Ready/MLS derivative. Videos, files that are already web-sized, and photos whose
// original was stripped by 1-year retention are not eligible (there's nothing
// full-res left to resize, and the web-sized file already serves as its own MLS).
export function photoNeedsWebVersion(m = {}) {
  if (!m || !m.key) return false;
  if (isVideo(m)) return false;
  if (m.originalRemoved || m.webSized || isWebSized(m)) return false;
  return true;
}

// A Web Ready version is PRESENT once its derivative exists in R2 (m.webKey), or
// the photo is itself already web-sized (it is its own MLS version).
export function photoWebReady(m = {}) {
  return !!m.webKey || isWebSized(m);
}

// Generation has permanently given up on this photo (retry budget exhausted).
export function photoWebExhausted(m = {}) {
  return m.webStatus === "failed" && (Number(m.webAttempts) || 0) >= MAX_WEB_ATTEMPTS;
}

// The generator should (re)attempt this photo on this run: it's eligible, has no
// derivative yet, and hasn't exhausted its retry budget. A previously-"failed"
// photo with attempts remaining is therefore retried automatically.
export function photoWebPending(m = {}) {
  return photoNeedsWebVersion(m) && !photoWebReady(m) && !photoWebExhausted(m);
}

// Roll up a gallery's Web Ready generation state.
//   total   – eligible full-res photos
//   ready   – have their Web Ready derivative
//   pending – still to generate (will be attempted/retried)
//   failed  – gave up after MAX_WEB_ATTEMPTS (won't block the build)
//   done    – nothing left to process (pending === 0) → safe to build the ZIP
export function webPhotoProgress(gallery = {}) {
  const media = gallery.media || [];
  let total = 0, ready = 0, pending = 0, failed = 0;
  for (const m of media) {
    if (!photoNeedsWebVersion(m)) continue;
    total++;
    if (photoWebReady(m)) ready++;
    else if (photoWebExhausted(m)) failed++;
    else pending++;
  }
  return { total, ready, pending, failed, done: pending === 0 };
}

// Resize an image buffer to a 2048px progressive JPEG. Resolves { buffer, bytes }.
// Sharp is imported lazily so modules that only need the state predicates above
// (the ZIP enqueue gate, the completion guard, status endpoints) don't pull the
// native Sharp binary into their bundle.
export async function generateWebPhoto(inputBuffer) {
  const sharp = (await import("sharp")).default;
  const buffer = await sharp(inputBuffer)
    .resize({ width: WEB_PHOTO_MAX_PX, withoutEnlargement: true })
    .jpeg({ quality: WEB_PHOTO_QUALITY, progressive: true })
    .toBuffer();
  return { buffer, bytes: buffer.length };
}
