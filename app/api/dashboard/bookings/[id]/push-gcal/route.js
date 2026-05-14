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

  // Build event date/time — use shootDate/shootTime or preferredDate/preferredTime
  const dateStr = booking.shootDate || booking.preferredDate;
  const timeStr = booking.shootTime || booking.preferredTime;

  if (!dateStr) {
    return Response.json({ error: "Booking has no scheduled date" }, { status: 400 });
  }

  let startDateTime, endDateTime;
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    const startMs = new Date(`${dateStr}T00:00:00`).setHours(h, m, 0, 0);
    startDateTime = new Date(startMs).toISOString();
    endDateTime   = new Date(startMs + 2 * 60 * 60 * 1000).toISOString(); // 2h default duration
  } else {
    // All-day event
    startDateTime = null;
    endDateTime   = null;
  }

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

  const eventBody = timeStr
    ? {
        summary,
        description,
        location: address,
        start: { dateTime: startDateTime, timeZone: "UTC" },
        end:   { dateTime: endDateTime,   timeZone: "UTC" },
      }
    : {
        summary,
        description,
        location: address,
        start: { date: dateStr },
        end:   { date: dateStr },
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
