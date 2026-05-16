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

async function getAccessToken(memberRef, gcal) {
  let accessToken = gcal.accessToken;
  if (!accessToken || (gcal.expiresAt && Date.now() > gcal.expiresAt - 60000)) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: gcal.refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    accessToken = data.access_token;
    await memberRef.update({
      "googleCalendar.accessToken": accessToken,
      "googleCalendar.expiresAt":   Date.now() + data.expires_in * 1000,
    });
  }
  return accessToken;
}

// POST — push this booking as an event to the assigned photographer's Google Calendar
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);

  const doc = await bookingRef.get();
  if (!doc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = doc.data();

  if (!booking.photographerId) {
    return Response.json({ error: "No photographer assigned to this booking" }, { status: 400 });
  }

  const memberRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(booking.photographerId);

  const memberDoc = await memberRef.get();
  if (!memberDoc.exists) return Response.json({ error: "Photographer not found" }, { status: 404 });

  const gcal = memberDoc.data().googleCalendar;
  if (!gcal?.refreshToken) {
    return Response.json({ error: "Photographer has not connected Google Calendar" }, { status: 400 });
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(memberRef, gcal);
  } catch (e) {
    return Response.json({ error: `Token error: ${e.message}` }, { status: 401 });
  }

  // Build event date/time — prefer confirmed shootDate/shootTime over preferred*
  const dateStr = booking.shootDate || booking.preferredDate;
  // Only treat as a specific time if it matches HH:MM format — reject "morning", "afternoon", etc.
  const rawTime = booking.shootTime || booking.preferredTimeSpecific || "";
  const timeStr = /^\d{1,2}:\d{2}$/.test(rawTime) ? rawTime : null;

  if (!dateStr) {
    return Response.json({ error: "Booking has no scheduled date" }, { status: 400 });
  }

  let startDateTime, endDateTime;
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    // Build datetime string then parse — avoids DST edge cases from setHours
    const paddedH = String(h).padStart(2, "0");
    const paddedM = String(m).padStart(2, "0");
    startDateTime = `${dateStr}T${paddedH}:${paddedM}:00`;
    const durationMin = Number(booking.shootDuration) > 0 ? Number(booking.shootDuration) : 120;
    const endMs = new Date(startDateTime).getTime() + durationMin * 60 * 1000;
    endDateTime = new Date(endMs).toISOString().replace(".000Z", "");
    // Trim to local-style datetime for use with named timezone
    startDateTime = startDateTime;
  } else {
    // All-day event — GCal requires end = next day (exclusive end)
    startDateTime = null;
    endDateTime   = null;
  }

  // Determine tenant timezone for GCal events — fall back to UTC
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenantTimezone = tenantDoc.exists
    ? (tenantDoc.data().timezone || tenantDoc.data().bookingConfig?.timezone || "America/New_York")
    : "America/New_York";

  const address = booking.fullAddress || booking.bookingAddress || booking.address || "Address TBD";
  const client  = booking.agentName   || booking.clientName     || booking.clientEmail || "Client";
  const summary = `Photography: ${address}`;
  const description = [
    `Client: ${client}`,
    booking.clientEmail ? `Email: ${booking.clientEmail}` : null,
    booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
    timeStr ? `Time: ${timeStr}` : null,
    `Booking ID: ${params.id}`,
  ].filter(Boolean).join("\n");

  // All-day end date must be the NEXT day (GCal uses exclusive end)
  const allDayEndDate = (() => {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const eventBody = timeStr
    ? {
        summary,
        description,
        location: address,
        start: { dateTime: startDateTime, timeZone: tenantTimezone },
        end:   { dateTime: endDateTime,   timeZone: tenantTimezone },
      }
    : {
        summary,
        description,
        location: address,
        start: { date: dateStr },
        end:   { date: allDayEndDate },
      };

  // Check if we already pushed this booking (to avoid duplicates)
  let existingEventId = booking.gcalEventId;
  let calRes;

  if (existingEventId) {
    // Update existing event
    calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`,
      {
        method: "PUT",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
    // If event was deleted on Google's side, fall through to create
    if (calRes.status === 404 || calRes.status === 410) {
      existingEventId = null;
    }
  }

  if (!existingEventId) {
    calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );
  }

  if (!calRes.ok) {
    const err = await calRes.json().catch(() => ({}));
    return Response.json({ error: err.error?.message || "Google Calendar API error" }, { status: 502 });
  }

  const event = await calRes.json();

  // Save the GCal event ID on the booking for future updates
  await bookingRef.update({ gcalEventId: event.id, gcalSyncedAt: new Date().toISOString() });

  return Response.json({ ok: true, eventId: event.id, eventLink: event.htmlLink });
}
