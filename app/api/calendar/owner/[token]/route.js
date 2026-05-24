import { adminDb } from "@/lib/firebase-admin";

// Public iCal feed for the tenant owner — authenticated by ownerCalendarToken (obscure URL).
// Compatible with Apple Calendar, Google Calendar, Outlook, and any iCal-supporting app.

export async function GET(req, { params }) {
  const { token } = params;
  if (!token || token.length < 20) return new Response("Not found", { status: 404 });

  try {
    const tenantSnap = await adminDb
      .collection("tenants")
      .where("ownerCalendarToken", "==", token)
      .limit(1)
      .get();

    if (tenantSnap.empty) return new Response("Not found", { status: 404 });

    const tenantDoc  = tenantSnap.docs[0];
    const tenantId   = tenantDoc.id;
    const tenant     = tenantDoc.data();
    const tenantName = tenant.businessName || "KyoriaOS";
    const ownerName  = tenant.ownerName || tenant.businessName || "Owner";

    // All bookings (owner sees everything)
    const bookingsSnap = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings")
      .where("status", "in", ["confirmed", "completed", "booked", "appointment_confirmed"])
      .get();

    const bookings = bookingsSnap.docs.map((d) => d.data());
    const ical     = buildICal(ownerName, bookings, tenantName);

    return new Response(ical, {
      status: 200,
      headers: {
        "Content-Type":        "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="owner-schedule.ics"`,
        "Cache-Control":       "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("Owner iCal feed error:", err);
    return new Response("Server error", { status: 500 });
  }
}

function buildICal(ownerName, bookings, tenantName) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//KyoriaOS//KyoriaOS//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcal(ownerName)} - ${escIcal(tenantName)}`,
    "X-WR-CALDESC:Full shoot schedule from KyoriaOS",
  ];

  for (const b of bookings) {
    const uid = `booking-${b.id}@kyoriaos.com`;

    function toDateStr(val) {
      if (!val) return null;
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
      if (val.toDate) return val.toDate().toISOString().slice(0, 10);
      if (val._seconds) return new Date(val._seconds * 1000).toISOString().slice(0, 10);
      const d = new Date(val);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }

    let dtStart, dtEnd;
    const shootDateStr = toDateStr(b.shootDate);
    if (shootDateStr) {
      const rawTime = b.shootTime || b.preferredTimeSpecific || "";
      const timeStr = /^\d{1,2}:\d{2}$/.test(rawTime) ? rawTime.padStart(5, "0") : "12:00";
      const d       = new Date(`${shootDateStr}T${timeStr}:00`);
      dtStart        = toICalDate(d);
      const dur      = (b.shootDuration && Number(b.shootDuration) > 0) ? Number(b.shootDuration) : 120;
      dtEnd          = toICalDate(new Date(d.getTime() + dur * 60 * 1000));
    } else if (b.preferredDate) {
      const ds = toDateStr(b.preferredDate) || b.preferredDate;
      if (!ds) continue;
      const startD = new Date(ds + "T12:00:00Z");
      dtStart = ds.replace(/-/g, "") + "T120000Z";
      dtEnd   = new Date(startD.getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, "") + "T120000Z";
    } else {
      continue;
    }

    const descParts = [];
    if (b.clientName)        descParts.push(`Client: ${b.clientName}`);
    if (b.photographerName)  descParts.push(`Photographer: ${b.photographerName}`);
    if (b.packageId)         descParts.push(`Package: ${b.packageId}`);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toICalDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escIcal(b.address || "Shoot")}`,
      descParts.length ? `DESCRIPTION:${escIcal(descParts.join("\\n"))}` : "",
      b.address ? `LOCATION:${escIcal(b.address)}` : "",
      `STATUS:CONFIRMED`,
      "END:VEVENT",
    ).filter(Boolean);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function toICalDate(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escIcal(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
