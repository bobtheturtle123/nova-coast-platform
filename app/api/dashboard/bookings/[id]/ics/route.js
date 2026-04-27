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

// GET /api/dashboard/bookings/[id]/ics
// Returns a .ics calendar file for the booking's shoot date
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!doc.exists) return new Response("Not found", { status: 404 });

  const booking = doc.data();
  const dateRaw = booking.shootDate || booking.preferredDate;
  if (!dateRaw) return new Response("No date set", { status: 400 });

  // Normalize date to YYYY-MM-DD
  let dateStr;
  if (dateRaw?._seconds) {
    dateStr = new Date(dateRaw._seconds * 1000).toISOString().split("T")[0];
  } else if (dateRaw?.toDate) {
    dateStr = dateRaw.toDate().toISOString().split("T")[0];
  } else {
    dateStr = String(dateRaw).split("T")[0];
  }

  const icsDate = dateStr.replace(/-/g, "");
  const title   = `Photo Shoot — ${booking.fullAddress || booking.address || "Property"}`;
  const location = booking.fullAddress || booking.address || "";
  const description = `Client: ${booking.clientName}\\nEmail: ${booking.clientEmail}${booking.clientPhone ? "\\nPhone: " + booking.clientPhone : ""}`;
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KyoriaOS//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.id}@kyoriaos`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${icsDate}`,
    `DTEND;VALUE=DATE:${icsDate}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${params.id}.ics"`,
    },
  });
}
