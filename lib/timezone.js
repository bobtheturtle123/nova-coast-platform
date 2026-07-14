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

// US state / territory → dominant IANA timezone. Reliable for the ~90% of
// states that sit in a single zone; split states (FL panhandle, west TX, etc.)
// are refined by ZIP below when available.
const STATE_TZ = {
  AL: "America/Chicago",   AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago",   CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",  DE: "America/New_York",  DC: "America/New_York",
  FL: "America/New_York",  GA: "America/New_York",  HI: "Pacific/Honolulu",
  ID: "America/Denver",    IL: "America/Chicago",   IN: "America/New_York",
  IA: "America/Chicago",   KS: "America/Chicago",   KY: "America/New_York",
  LA: "America/Chicago",   ME: "America/New_York",  MD: "America/New_York",
  MA: "America/New_York",  MI: "America/New_York",  MN: "America/Chicago",
  MS: "America/Chicago",   MO: "America/Chicago",   MT: "America/Denver",
  NE: "America/Chicago",   NV: "America/Los_Angeles", NH: "America/New_York",
  NJ: "America/New_York",  NM: "America/Denver",    NY: "America/New_York",
  NC: "America/New_York",  ND: "America/Chicago",   OH: "America/New_York",
  OK: "America/Chicago",   OR: "America/Los_Angeles", PA: "America/New_York",
  RI: "America/New_York",  SC: "America/New_York",  SD: "America/Chicago",
  TN: "America/Chicago",   TX: "America/Chicago",   UT: "America/Denver",
  VT: "America/New_York",  VA: "America/New_York",  WA: "America/Los_Angeles",
  WV: "America/New_York",  WI: "America/Chicago",   WY: "America/Denver",
  PR: "America/Puerto_Rico", VI: "America/Puerto_Rico", GU: "Pacific/Guam",
};

function tzFromState(state) {
  const s = String(state || "").trim().toUpperCase();
  return STATE_TZ[s] || null;
}

// Resolve the timezone for a BOOKING's shoot time. The shoot time is local to
// the PROPERTY being photographed — not the tenant HQ or whoever booked it —
// so a California member booking a Miami shoot still gets Eastern. Order:
// explicit per-booking tz → property ZIP → property state → tenant → Eastern.
export function resolveBookingTimezone(booking, tenant) {
  if (booking?.timezone) return booking.timezone;
  // State is the most reliable property signal (whole-state zones); ZIP is a
  // fallback only when state is missing, since our ZIP map is coarse.
  const byState = tzFromState(booking?.state || booking?.propertyState);
  if (byState) return byState;
  const byZip = tzFromZip(booking?.zip || booking?.propertyZip);
  if (byZip) return byZip;
  return resolveTenantTimezone(tenant);
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
