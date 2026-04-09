import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/tenant-public/[slug]/availability?date=YYYY-MM-DD
 *
 * Returns available time slots for a given date based on the tenant's
 * availability config (mode: "slots" | "real").
 */
export async function GET(req, { params }) {
  const { slug } = params;
  const url  = new URL(req.url);
  const date = url.searchParams.get("date"); // "YYYY-MM-DD"

  if (!date) return Response.json({ error: "date required" }, { status: 400 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const avail = tenant.bookingConfig?.availability || {};
  const mode           = avail.mode           || "slots";
  const start          = avail.businessHours?.start || "08:00";
  const end            = avail.businessHours?.end   || "18:00";
  const intervalMin    = Number(avail.intervalMinutes) || 30;
  const durationMin    = Number(avail.defaultDuration) || 120;
  const bufferMin      = Number(avail.bufferMinutes)   || 30;

  // Build all candidate slots within business hours
  const allSlots = buildSlots(start, end, intervalMin);

  if (mode === "slots") {
    return Response.json({ slots: allSlots });
  }

  // "real" mode: fetch confirmed/requested bookings on this date and block taken slots
  const bookingsSnap = await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("bookings")
    .where("preferredDate", "==", date)
    .where("status", "in", ["confirmed", "requested", "completed"])
    .get();

  const blocked = bookingsSnap.docs.map((d) => {
    const b = d.data();
    // preferredTime might be a "HH:MM" string (new) or a label like "morning"
    const time = parseTime(b.preferredTime || b.shootTime);
    if (time === null) return null;
    return { start: time, end: time + durationMin + bufferMin };
  }).filter(Boolean);

  const available = allSlots.filter((slot) => {
    const slotMin = timeToMinutes(slot);
    const slotEnd = slotMin + durationMin;
    // Slot is available if it doesn't overlap any blocked range
    return !blocked.some((b) => slotMin < b.end && slotEnd > b.start);
  });

  return Response.json({ slots: available });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildSlots(start, end, intervalMin) {
  const slots = [];
  let cur = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  while (cur < endMin) {
    slots.push(minutesToTime(cur));
    cur += intervalMin;
  }
  return slots;
}

function timeToMinutes(t) {
  if (!t || typeof t !== "string") return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTime(val) {
  if (!val) return null;
  // If it's already "HH:MM" format
  if (/^\d{1,2}:\d{2}$/.test(val)) return timeToMinutes(val);
  // Generic labels — map to an approximate start time
  if (val === "morning")   return timeToMinutes("08:00");
  if (val === "afternoon") return timeToMinutes("12:00");
  return null;
}
