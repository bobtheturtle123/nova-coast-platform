import { adminDb } from "@/lib/firebase-admin";
import { resolveBookingTimezone, addMinutesToNaive } from "@/lib/timezone";

// `tokenRef` is the doc holding the token; `prefix` is the field path
// ("googleCalendar" for members, "ownerGoogleCalendar" for the owner on the
// tenant doc).
async function getAccessToken(tokenRef, gcal, prefix) {
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
    await tokenRef.update({
      [`${prefix}.accessToken`]: accessToken,
      [`${prefix}.expiresAt`]:   Date.now() + data.expires_in * 1000,
    });
  }
  return accessToken;
}

/**
 * Push (create or update) a booking as an event on the assigned photographer's
 * Google Calendar. The event time is anchored to the PROPERTY's timezone.
 * Returns { ok, skipped?, reason?, eventId? }. Never throws for expected
 * conditions (no photographer / not connected) — those return skipped.
 */
export async function pushBookingToGcal(tenantId, bookingId) {
  const bookingRef = adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(bookingId);
  const doc = await bookingRef.get();
  if (!doc.exists) return { ok: false, reason: "Booking not found" };
  const booking = doc.data();

  if (!booking.photographerId) return { ok: false, skipped: true, reason: "No photographer assigned" };

  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  const tenantDoc = await tenantRef.get();
  const tenantData = tenantDoc.exists ? tenantDoc.data() : {};

  // Resolve the calendar token. The OWNER-as-photographer ("__owner__") stores
  // their token on the tenant doc (ownerGoogleCalendar); team members store it
  // on their team doc (googleCalendar). Previously only the team path was
  // handled, so owner shoots never landed on Google Calendar.
  let gcal, tokenRef, tokenPrefix;
  if (booking.photographerId === "__owner__") {
    gcal = tenantData.ownerGoogleCalendar;
    tokenRef = tenantRef;
    tokenPrefix = "ownerGoogleCalendar";
  } else {
    const memberRef = tenantRef.collection("team").doc(booking.photographerId);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) return { ok: false, skipped: true, reason: "Photographer not found" };
    const memberData = memberDoc.data();
    if (memberData.calendarPrefs?.writeBookings === false) return { ok: false, skipped: true, reason: "Calendar write disabled" };
    gcal = memberData.googleCalendar;
    tokenRef = memberRef;
    tokenPrefix = "googleCalendar";
  }
  if (!gcal?.refreshToken) return { ok: false, skipped: true, reason: "Google Calendar not connected" };

  const accessToken = await getAccessToken(tokenRef, gcal, tokenPrefix);

  const dateStr = booking.shootDate || booking.preferredDate;
  if (!dateStr) return { ok: false, skipped: true, reason: "No scheduled date" };
  const rawTime = booking.shootTime || booking.preferredTimeSpecific || "";
  const timeStr = /^\d{1,2}:\d{2}$/.test(rawTime) ? rawTime : null;

  // Property-anchored timezone (not tenant HQ, not whoever booked it).
  const timeZone = resolveBookingTimezone(booking, tenantData);

  let startDateTime = null, endDateTime = null;
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    startDateTime = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const durationMin = Number(booking.shootDuration) > 0 ? Number(booking.shootDuration) : 120;
    endDateTime = addMinutesToNaive(dateStr, h, m, durationMin);
  }

  const allDayEndDate = (() => {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const address = booking.fullAddress || booking.bookingAddress || booking.address || "Address TBD";
  const client  = booking.agentName || booking.clientName || booking.clientEmail || "Client";

  // Resolve what's being shot so the photographer sees it at a glance.
  let serviceNames = [];
  try {
    const { getTenantCatalog } = await import("@/lib/tenants");
    const { resolveBookingServiceNames } = await import("@/lib/bookingServices");
    serviceNames = resolveBookingServiceNames(booking, await getTenantCatalog(tenantId));
  } catch { /* non-fatal */ }
  const servicesLine = serviceNames.length ? `Services: ${serviceNames.join(", ")}` : null;
  const summaryServices = serviceNames.length ? ` (${serviceNames.slice(0, 3).join(", ")}${serviceNames.length > 3 ? "…" : ""})` : "";

  const eventBody = timeStr
    ? {
        summary: `Photography: ${address}${summaryServices}`,
        description: [
          `Client: ${client}`,
          booking.clientEmail ? `Email: ${booking.clientEmail}` : null,
          booking.clientPhone ? `Phone: ${booking.clientPhone}` : null,
          servicesLine,
          `Time: ${timeStr} (${timeZone})`,
          booking.notes ? `Notes: ${booking.notes}` : null,
          `Booking ID: ${bookingId}`,
        ].filter(Boolean).join("\n"),
        location: address,
        start: { dateTime: startDateTime, timeZone },
        end:   { dateTime: endDateTime,   timeZone },
      }
    : {
        summary: `Photography: ${address}${summaryServices}`,
        description: [`Client: ${client}`, servicesLine, `Booking ID: ${bookingId}`].filter(Boolean).join("\n"),
        location: address,
        start: { date: dateStr },
        end:   { date: allDayEndDate },
      };

  let existingEventId = booking.gcalEventId;
  let calRes;
  if (existingEventId) {
    calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`,
      { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) }
    );
    if (calRes.status === 404 || calRes.status === 410) existingEventId = null;
  }
  if (!existingEventId) {
    calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) }
    );
  }

  if (!calRes.ok) {
    const err = await calRes.json().catch(() => ({}));
    return { ok: false, reason: err.error?.message || "Google Calendar API error" };
  }

  const event = await calRes.json();
  await bookingRef.update({ gcalEventId: event.id, gcalSyncedAt: new Date().toISOString(), gcalTimeZone: timeZone });
  return { ok: true, eventId: event.id, eventLink: event.htmlLink, timeZone };
}

// Delete a booking's Google Calendar event (used on cancel / postpone). Clears
// gcalEventId so a later reschedule creates a fresh event. Safe to call when
// nothing is connected — returns skipped.
export async function deleteBookingGcalEvent(tenantId, bookingId) {
  const bookingRef = adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(bookingId);
  const doc = await bookingRef.get();
  if (!doc.exists) return { ok: false, reason: "Booking not found" };
  const booking = doc.data();
  if (!booking.gcalEventId) return { ok: false, skipped: true, reason: "No calendar event" };
  if (!booking.photographerId) return { ok: false, skipped: true, reason: "No photographer" };

  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  const tenantDoc = await tenantRef.get();
  const tenantData = tenantDoc.exists ? tenantDoc.data() : {};

  let gcal, tokenRef, tokenPrefix;
  if (booking.photographerId === "__owner__") {
    gcal = tenantData.ownerGoogleCalendar; tokenRef = tenantRef; tokenPrefix = "ownerGoogleCalendar";
  } else {
    const memberRef = tenantRef.collection("team").doc(booking.photographerId);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) return { ok: false, skipped: true, reason: "Photographer not found" };
    gcal = memberDoc.data().googleCalendar; tokenRef = memberRef; tokenPrefix = "googleCalendar";
  }
  if (!gcal?.refreshToken) {
    // Nothing to delete via API — just forget the id.
    await bookingRef.update({ gcalEventId: null });
    return { ok: false, skipped: true, reason: "Google Calendar not connected" };
  }

  try {
    const accessToken = await getAccessToken(tokenRef, gcal, tokenPrefix);
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.gcalEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    console.error("[deleteBookingGcalEvent]", e?.message);
  }
  await bookingRef.update({ gcalEventId: null });
  return { ok: true };
}
