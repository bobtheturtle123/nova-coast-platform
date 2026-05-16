import { adminDb } from "@/lib/firebase-admin";

// Public iCal feed for a photographer — authenticated by calendarToken (obscure URL).
// Compatible with Apple Calendar, Google Calendar, Outlook, and any iCal-supporting app.

export async function GET(req, { params }) {
  const { token } = params;
  if (!token || token.length < 20) {
    return new Response("Not found", { status: 404 });
  }

  // Look up the token in the top-level calendarTokens collection (avoids collectionGroup index)
  try {
    const tokenDoc = await adminDb.collection("calendarTokens").doc(token).get();
    if (!tokenDoc.exists) {
      return new Response("Not found", { status: 404 });
    }

    const { tenantId, memberId } = tokenDoc.data();

    const memberDoc = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("team").doc(memberId)
      .get();

    if (!memberDoc.exists) {
      return new Response("Not found", { status: 404 });
    }

    const member = memberDoc.data();

    // Fetch bookings assigned to this photographer
    const bookingsSnap = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings")
      .where("photographerId", "==", memberId)
      .where("status", "in", ["confirmed", "completed"])
      .get();

    const bookings = bookingsSnap.docs.map((d) => d.data());

    // Also get tenant name for calendar title
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const tenantName = tenantDoc.exists
      ? (tenantDoc.data().businessName || "KyoriaOS")
      : "KyoriaOS";

    const ical = buildICal(member, bookings, tenantName);

    return new Response(ical, {
      status: 200,
      headers: {
        "Content-Type":        "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${slugify(member.name)}-schedule.ics"`,
        "Cache-Control":       "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("iCal feed error:", err);
    return new Response("Server error", { status: 500 });
  }
}

// ─── iCal helpers ─────────────────────────────────────────────────────────────

function buildICal(member, bookings, tenantName) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//KyoriaOS//KyoriaOS//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcal(member.name)} - ${escIcal(tenantName)}`,
    "X-WR-CALDESC:Shoot schedule from KyoriaOS",
    "X-WR-TIMEZONE:America/Chicago",
  ];

  for (const b of bookings) {
    const uid = `booking-${b.id}@kyoriaos.com`;

    // Normalize a shootDate value that may be a Firestore Timestamp, JS Date, or string
    function toDateStr(val) {
      if (!val) return null;
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
      if (val.toDate) return val.toDate().toISOString().slice(0, 10); // Firestore Timestamp
      if (val._seconds) return new Date(val._seconds * 1000).toISOString().slice(0, 10);
      const d = new Date(val);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }

    // Build start/end datetimes
    let dtStart, dtEnd;
    const shootDateStr = toDateStr(b.shootDate);
    if (shootDateStr) {
      // Guard against non-specific presets (morning/afternoon) — fall back to noon
      const rawTime = b.shootTime || b.preferredTimeSpecific || "";
      const timeStr = /^\d{1,2}:\d{2}$/.test(rawTime) ? rawTime.padStart(5, "0") : "12:00";
      const startISO = `${shootDateStr}T${timeStr}:00`;
      const d = new Date(startISO);
      dtStart = toICalDate(d);
      const durationMin = (b.shootDuration && Number(b.shootDuration) > 0) ? Number(b.shootDuration) : 120;
      dtEnd = toICalDate(new Date(d.getTime() + durationMin * 60 * 1000));
    } else if (b.preferredDate) {
      // All-day event if no confirmed time — end must be next day (iCal exclusive end)
      const ds = toDateStr(b.preferredDate) || b.preferredDate;
      if (!ds) continue;
      const startD = new Date(ds + "T12:00:00Z");
      const endD   = new Date(startD.getTime() + 24 * 60 * 60 * 1000);
      dtStart = ds.replace(/-/g, "") + "T120000Z";
      dtEnd   = endD.toISOString().slice(0, 10).replace(/-/g, "") + "T120000Z";
    } else {
      continue; // no date info — skip
    }

    // Summary line
    const summary = b.address || "Shoot";

    // Description — intentionally omits client phone/email to prevent PII leaking
    // into third-party calendar services (Google, iCloud, Outlook).
    const descParts = [];
    if (b.clientName)    descParts.push(`Client: ${b.clientName}`);
    if (b.packageId)     descParts.push(`Package: ${b.packageId}`);
    if (b.preferredTime) descParts.push(`Time: ${b.preferredTime}`);
    const description = descParts.join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toICalDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escIcal(summary)}`,
      description ? `DESCRIPTION:${escIcal(description)}` : "",
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
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function slugify(name) {
  return (name || "photographer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
