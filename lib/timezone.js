// Tenant timezone resolution for calendar events.
//
// Booking times are entered as the STUDIO's local wall-clock time (when the
// photographer shows up at the property). To place that on a calendar we must
// label it with the studio's IANA timezone. Previously this defaulted to
// America/New_York for everyone, so any non-Eastern studio saw every event
// shifted by hours.
//
// Resolution order: explicit tenant setting → inferred from the studio's
// coordinates → inferred from US ZIP → America/New_York (last resort).

const US_TZS = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
];

// Rough continental-US longitude → timezone. Approximate near state borders,
// but fixes the gross multi-hour error; an explicit setting always wins.
function tzFromLongitude(lng) {
  if (typeof lng !== "number" || Number.isNaN(lng)) return null;
  if (lng >= -87.5)  return "America/New_York";
  if (lng >= -101.5) return "America/Chicago";
  if (lng >= -115)   return "America/Denver";
  if (lng >= -129)   return "America/Los_Angeles";
  return "America/Anchorage";
}

// Coarse US ZIP prefix → timezone fallback when we have no coordinates.
function tzFromZip(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}/.test(z)) return null;
  const p = Number(z.slice(0, 3));
  if (p >= 995) return "America/Anchorage";   // 995-999 AK
  if (p >= 970) return "America/Los_Angeles"; // 970-994 OR/WA (Pacific)
  if (p >= 967) return "Pacific/Honolulu";    // 967-969 HI
  if (p >= 900) return "America/Los_Angeles"; // 900-966 CA
  if (p >= 850 && p <= 864) return "America/Phoenix"; // AZ (no DST)
  if (p >= 800 && p <= 899) return "America/Denver";  // Mountain
  if (p >= 750 && p <= 799) return "America/Chicago"; // TX/Central-south
  if (p >= 550 && p <= 649) return "America/Chicago"; // Central
  if (p >= 350 && p <= 369) return "America/Chicago"; // AL/MS
  return "America/New_York";                  // Eastern default
}

export function resolveTenantTimezone(tenant) {
  if (!tenant) return "America/New_York";
  const explicit = tenant.timezone || tenant.bookingConfig?.timezone;
  if (explicit && US_TZS.includes(explicit)) return explicit;
  if (explicit) return explicit; // trust any other valid IANA string the tenant set

  const coords = tenant.defaultCoords || {};
  const byLng = tzFromLongitude(Number(coords.lng ?? coords.lon ?? coords.longitude));
  if (byLng) return byLng;

  const byZip = tzFromZip(tenant.fromZip || tenant.zip);
  if (byZip) return byZip;

  return "America/New_York";
}

// Add minutes to a naive "YYYY-MM-DDTHH:MM:SS" wall-clock string WITHOUT being
// affected by the server's timezone. Treats the value as UTC purely for the
// arithmetic and reads the UTC components back, so the wall-clock result is
// stable regardless of where the code runs (Vercel = UTC, local dev, etc.).
export function addMinutesToNaive(dateStr, hh, mm, durationMin) {
  const [Y, Mo, D] = String(dateStr).split("-").map(Number);
  const baseMs = Date.UTC(Y, (Mo || 1) - 1, D || 1, hh, mm, 0);
  const end = new Date(baseMs + (Number(durationMin) || 0) * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return `${end.getUTCFullYear()}-${p(end.getUTCMonth() + 1)}-${p(end.getUTCDate())}T${p(end.getUTCHours())}:${p(end.getUTCMinutes())}:00`;
}

export const COMMON_TIMEZONES = US_TZS;
