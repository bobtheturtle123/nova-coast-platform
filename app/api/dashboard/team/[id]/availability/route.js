import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

function timeToMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minToHHMM(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// GET /api/dashboard/team/[id]/availability?date=YYYY-MM-DD
// Returns busy time ranges for a team member on a given date
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // "YYYY-MM-DD"
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const memberId = params.id;
  const busy = [];

  // 1. Check timeBlocks (includes Google-synced and manual blocks)
  const blocksSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .where("memberId", "==", memberId)
    .get();

  for (const doc of blocksSnap.docs) {
    const b = doc.data();
    const startDate = (b.startDate || "").slice(0, 10);
    const endDate   = (b.endDate   || "").slice(0, 10);
    if (date < startDate || date > endDate) continue;

    if (b.startTime && b.endTime) {
      // Timed block — convert ISO timestamps to HH:MM
      const start = new Date(b.startTime);
      const end   = new Date(b.endTime);
      // Check it overlaps this date
      const startDateStr = start.toISOString().slice(0, 10);
      const endDateStr   = end.toISOString().slice(0, 10);
      if (date < startDateStr || date > endDateStr) continue;

      // For same-day blocks, extract HH:MM
      if (startDateStr === date) {
        busy.push({
          start: `${String(start.getUTCHours()).padStart(2,"0")}:${String(start.getUTCMinutes()).padStart(2,"0")}`,
          end:   `${String(end.getUTCHours()).padStart(2,"0")}:${String(end.getUTCMinutes()).padStart(2,"0")}`,
          reason: b.reason || "Busy",
        });
      } else {
        // Multi-day block — mark all day
        busy.push({ start: "00:00", end: "23:59", reason: b.reason || "Busy" });
      }
    } else {
      // All-day block
      busy.push({ start: "00:00", end: "23:59", reason: b.reason || "All day" });
    }
  }

  // 2. Check confirmed bookings on this date for this photographer
  const bookingsSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings")
    .where("photographerId", "==", memberId)
    .where("shootDate", "==", date)
    .get();

  for (const doc of bookingsSnap.docs) {
    const b = doc.data();
    if (!["confirmed", "completed", "requested"].includes(b.status)) continue;

    const startHHMM = b.shootTime || "00:00";
    const duration  = Number(b.shootDuration) || 120;
    const buffer    = Number(b.bookingBuffer)  || 30;
    const startMin  = timeToMin(startHHMM);
    const endMin    = startMin + duration + buffer;

    busy.push({
      start:  startHHMM,
      end:    minToHHMM(Math.min(endMin, 23 * 60 + 59)),
      reason: "Booked",
    });
  }

  return Response.json({ date, memberId, busy });
}
