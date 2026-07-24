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

  const primaryDate = booking.shootDate || booking.preferredDate;
  if (!primaryDate) return { ok: false, skipped: true, reason: "No scheduled date" };
  const primaryTime = booking.shootTime || booking.preferredTimeSpecific || "";

  // Property-anchored timezone (not tenant HQ, not whoever booked it).
  const timeZone = resolveBookingTimezone(booking, tenantData);

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

  // Builds a calendar event body for one appointment (timed or all-day).
  function buildEventBody(dateStr, rawTime, label) {
    const timeStr = /^\d{1,2}:\d{2}$/.test(rawTime || "") ? rawTime : null;
    const summary = `Photography: ${address}${summaryServices}${label ? ` — ${label}` : ""}`;
    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      const startDateTime = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const durationMin = Number(booking.shootDuration) > 0 ? Number(booking.shootDuration) : 120;
      const endDateTime = addMinutesToNaive(dateStr, h, m, durationMin);
      return {
        summary,
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
      };
    }
    const allDayEndDate = (() => {
      const d = new Date(dateStr + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    return {
      summary,
      description: [`Client: ${client}`, servicesLine, `Booking ID: ${bookingId}`].filter(Boolean).join("\n"),
      location: address,
      start: { date: dateStr },
      end:   { date: allDayEndDate },
    };
  }

  // Create or update one event; returns the event id, or throws on API error.
  async function upsertEvent(eventBody, existingEventId) {
    let id = existingEventId;
    let res;
    if (id) {
      res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,
        { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) }
      );
      if (res.status === 404 || res.status === 410) id = null; // event gone — recreate
    }
    if (!id) {
      res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) }
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "Google Calendar API error");
    }
    return (await res.json()).id;
  }

  async function deleteEvent(id) {
    if (!id) return;
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) { console.error("[pushBookingToGcal] delete stale event failed:", e?.message); }
  }

  // Primary appointment — a failure here is the booking's main event, so surface it.
  let primaryId;
  try {
    primaryId = await upsertEvent(buildEventBody(primaryDate, primaryTime, null), booking.gcalEventId);
  } catch (e) {
    return { ok: false, reason: e?.message || "Google Calendar API error" };
  }

  // Additional appointments — each gets its own event, tracked by parallel index.
  const additional  = Array.isArray(booking.additionalAppointments) ? booking.additionalAppointments : [];
  const prevAddlIds  = Array.isArray(booking.gcalAdditionalEventIds) ? booking.gcalAdditionalEventIds : [];
  const addlIds = [];
  for (let i = 0; i < additional.length; i++) {
    const a = additional[i] || {};
    if (!a.date) { addlIds.push(null); continue; }
    try {
      addlIds.push(await upsertEvent(buildEventBody(a.date, a.time, `Appt ${i + 2}`), prevAddlIds[i]));
    } catch (e) {
      console.error(`[pushBookingToGcal] additional appt ${i + 1} failed:`, e?.message);
      addlIds.push(prevAddlIds[i] || null); // keep any prior id so we don't orphan it
    }
  }
  // Remove events for appointments that were deleted since the last sync.
  for (let i = additional.length; i < prevAddlIds.length; i++) await deleteEvent(prevAddlIds[i]);

  await bookingRef.update({
    gcalEventId: primaryId,
    gcalAdditionalEventIds: addlIds,
    gcalSyncedAt: new Date().toISOString(),
    gcalTimeZone: timeZone,
  });
  return { ok: true, eventId: primaryId, additionalEventIds: addlIds, timeZone };
}

// Delete a booking's Google Calendar event (used on cancel / postpone). Clears
// gcalEventId so a later reschedule creates a fresh event. Safe to call when
// nothing is connected — returns skipped.
export async function deleteBookingGcalEvent(tenantId, bookingId) {
  const bookingRef = adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(bookingId);
  const doc = await bookingRef.get();
  if (!doc.exists) return { ok: false, reason: "Booking not found" };
  const booking = doc.data();
  const addlIds = Array.isArray(booking.gcalAdditionalEventIds) ? booking.gcalAdditionalEventIds.filter(Boolean) : [];
  if (!booking.gcalEventId && addlIds.length === 0) return { ok: false, skipped: true, reason: "No calendar event" };
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
    // Nothing to delete via API — just forget the ids.
    await bookingRef.update({ gcalEventId: null, gcalAdditionalEventIds: [] });
    return { ok: false, skipped: true, reason: "Google Calendar not connected" };
  }

  try {
    const accessToken = await getAccessToken(tokenRef, gcal, tokenPrefix);
    const ids = [booking.gcalEventId, ...addlIds].filter(Boolean);
    for (const id of ids) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch((e) => console.error("[deleteBookingGcalEvent] one event failed:", e?.message));
    }
  } catch (e) {
    console.error("[deleteBookingGcalEvent]", e?.message);
  }
  await bookingRef.update({ gcalEventId: null, gcalAdditionalEventIds: [] });
  return { ok: true };
}
