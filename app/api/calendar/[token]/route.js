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

    // Build start/end datetimes
    let dtStart, dtEnd;
    if (b.shootDate) {
      // Use actual shoot time if available, otherwise noon
      const dateStr = typeof b.shootDate === "string" && b.shootDate.length === 10
        ? b.shootDate
        : new Date(b.shootDate).toISOString().slice(0, 10);
      const timeStr = b.shootTime || b.preferredTime || "12:00";
      const startISO = `${dateStr}T${timeStr}:00`;
      const d = new Date(startISO);
      dtStart = toICalDate(d);
      // Use shootDuration if stored, else fallback to 2 hours
      const durationMin = (b.shootDuration && Number(b.shootDuration) > 0)
        ? Number(b.shootDuration)
        : 120;
      const endD = new Date(d.getTime() + durationMin * 60 * 1000);
      dtEnd = toICalDate(endD);
    } else if (b.preferredDate) {
      // All-day event if no confirmed time
      const ds = b.preferredDate; // "YYYY-MM-DD"
      dtStart = ds.replace(/-/g, "") + "T120000Z";
      dtEnd   = ds.replace(/-/g, "") + "T140000Z";
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
