// Media retention policy — full-resolution ORIGINAL PHOTO cleanup after 1 year.
//
// What this does (and does NOT do):
//   • After 1 year from a gallery's delivery date, the full-resolution ORIGINAL
//     photo files become eligible for removal from R2.
//   • Before an original is removed, a web-sized version (2048px) is generated so
//     the gallery still displays normally. Previews/thumbnails already exist.
//   • NOTHING ELSE is ever touched: floor plans, videos, documents, gallery
//     previews, thumbnails, web-sized images, property pages, gallery metadata,
//     property/order/client records, invoices, payments, download history.
//   • There is no "archive" state and nothing is hidden from users. Only the
//     full-res original DOWNLOAD becomes unavailable after a year.
//
// 1-YEAR ELIGIBILITY CALCULATION:
//   eligibility date = deliveredAt (fallback: deliveredDate / createdAt) + 365 days.
//   A media item is eligible only if ALL of:
//     - it is a photo (image/*)
//     - it is an original (not already web-sized — see isWebSized)
//     - its gallery was delivered and that delivery is >= 365 days ago
//     - the file has not already had its original stripped (m.originalRemoved)

export const RETENTION_DAYS = 365;
const DAY = 24 * 60 * 60 * 1000;

// Fields that mark a media item as already web-optimized (never an "original").
export function isWebSized(m = {}) {
  if (m.webSized || m.originalRemoved) return true;
  const key = (m.key || m.url || "").toLowerCase();
  // Our resized outputs are written under a /web/ segment or with a -web suffix.
  return key.includes("/web/") || /-web\.(jpg|jpeg|png|webp)$/.test(key);
}

export function isPhoto(m = {}) {
  const t = (m.fileType || "").toLowerCase();
  if (t) return t.startsWith("image/");
  const key = (m.key || m.url || "").toLowerCase();
  return /\.(jpg|jpeg|png|webp|tiff|tif|heic)$/.test(key);
}

// Resolve a gallery's delivery timestamp (ms) or null if never delivered.
export function deliveredAtMs(gallery = {}) {
  const raw = gallery.deliveredAt || gallery.deliveredDate || gallery.createdAt;
  if (!raw) return null;
  // Firestore Timestamp, ISO string, or Date
  if (typeof raw?.toMillis === "function") return raw.toMillis();
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Is this gallery past its 1-year retention window?
export function isPastRetention(gallery, now = Date.now()) {
  if (!gallery?.delivered && gallery?.status !== "delivered" && !gallery?.deliveredAt) {
    // Not delivered → retention clock hasn't started.
    return false;
  }
  const ms = deliveredAtMs(gallery);
  if (!ms) return false;
  return now - ms >= RETENTION_DAYS * DAY;
}

// Given a gallery, return the list of media items whose ORIGINAL photo file is
// eligible for cleanup, plus the total bytes that would be freed.
export function eligibleOriginals(gallery, now = Date.now()) {
  if (!isPastRetention(gallery, now)) return { items: [], bytes: 0 };
  const items = (gallery.media || []).filter(
    (m) => isPhoto(m) && !isWebSized(m) && !m.originalRemoved
  );
  const bytes = items.reduce((s, m) => s + (Number(m.size) || 0), 0);
  return { items, bytes };
}

// Days remaining until a gallery's originals become eligible (negative = already past).
export function daysUntilEligible(gallery, now = Date.now()) {
  const ms = deliveredAtMs(gallery);
  if (!ms) return null;
  return Math.ceil((ms + RETENTION_DAYS * DAY - now) / DAY);
}
