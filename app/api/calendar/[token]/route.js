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
      ? (tenantDoc.data().businessName || "NovaOS")
      : "NovaOS";

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
    `PRODID:-//NovaOS//NovaOS//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcal(member.name)} — ${escIcal(tenantName)}`,
    "X-WR-CALDESC:Shoot schedule from NovaOS",
    "X-WR-TIMEZONE:America/Chicago",
  ];

  for (const b of bookings) {
    const uid = `booking-${b.id}@nova-os.app`;

    // Build start/end datetimes
    let dtStart, dtEnd;
    if (b.shootDate) {
      const d = new Date(b.shootDate);
      dtStart = toICalDate(d);
      const end = new Date(d.getTime() + 2 * 60 * 60 * 1000); // +2 hours default
      dtEnd = toICalDate(end);
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
