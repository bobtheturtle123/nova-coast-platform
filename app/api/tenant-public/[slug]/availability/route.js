import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * GET /api/tenant-public/[slug]/availability?date=YYYY-MM-DD
 *
 * Returns available time slots for a given date based on the tenant's
 * availability config (mode: "slots" | "real").
 */
export async function GET(req, { params }) {
  const rl = await rateLimit(req, `availability:${params.slug}`, 60, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  const { slug } = params;
  const url  = new URL(req.url);
  const date = url.searchParams.get("date"); // "YYYY-MM-DD"

  if (!date) return Response.json({ error: "date required" }, { status: 400 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const avail = tenant.bookingConfig?.availability || {};
  const mode        = avail.mode           || "slots";
  const start       = avail.businessHours?.start || "08:00";
  const end         = avail.businessHours?.end   || "18:00";
  const workingDays = avail.businessHours?.days  || ["mon","tue","wed","thu","fri"];
  const intervalMin = Number(avail.intervalMinutes) || 30;
  const durationMin = Number(avail.defaultDuration) || 120;
  const bufferMin   = Number(avail.bufferMinutes)   || 30;

  // Check if the requested date falls on a working day
  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
  const requestedDayKey = DAY_KEYS[new Date(date + "T12:00:00").getDay()];
  if (!workingDays.includes(requestedDayKey)) {
    return Response.json({ slots: [] });
  }

  // Build all candidate slots within business hours
  const allSlots = buildSlots(start, end, intervalMin);

  // ── Check admin time blocks (always, regardless of mode) ─────────────────
  const blocksSnap = await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("timeBlocks")
    .where("startDate", "<=", date)
    .get();

  const dayBlocks = blocksSnap.docs
    .map((d) => d.data())
    .filter((b) => !b.endDate || b.endDate >= date);

  // Any full-day block → no slots at all
  if (dayBlocks.some((b) => !b.startTime || !b.endTime)) {
    return Response.json({ slots: [] });
  }

  // Time-ranged blocks: build blocked windows to subtract from slots
  const timedBlocks = dayBlocks
    .filter((b) => b.startTime && b.endTime)
    .map((b) => ({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) }));

  if (mode === "slots") {
    if (timedBlocks.length === 0) return Response.json({ slots: allSlots });
    const available = allSlots.filter((slot) => {
      const slotMin = timeToMinutes(slot);
      const slotEnd = slotMin + durationMin;
      return !timedBlocks.some((b) => slotMin < b.end && slotEnd > b.start);
    });
    return Response.json({ slots: available });
  }

  // "real" mode: fetch confirmed/requested bookings on this date and block taken slots
  const bookingsSnap = await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("bookings")
    .where("preferredDate", "==", date)
    .where("status", "in", ["confirmed", "requested", "completed"])
    .get();

  const blockedByBookings = bookingsSnap.docs.map((d) => {
    const b = d.data();
    const time = parseTime(b.preferredTime || b.shootTime);
    if (time === null) return null;
    return { start: time, end: time + durationMin + bufferMin };
  }).filter(Boolean);

  const available = allSlots.filter((slot) => {
    const slotMin = timeToMinutes(slot);
    const slotEnd = slotMin + durationMin;
    const overlapsBooking = blockedByBookings.some((b) => slotMin < b.end && slotEnd > b.start);
    const overlapsBlock   = timedBlocks.some((b) => slotMin < b.end && slotEnd > b.start);
    return !overlapsBooking && !overlapsBlock;
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
  if (/^\d{1,2}:\d{2}$/.test(val)) return timeToMinutes(val);
  if (val === "morning")   return timeToMinutes("08:00");
  if (val === "afternoon") return timeToMinutes("12:00");
  return null;
}
