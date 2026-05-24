import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// All-day events in freebusy show as UTC midnight-to-midnight intervals
function isAllDayBusy(start, end) {
  return (
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0 &&
    end.getUTCHours()   === 0 && end.getUTCMinutes()   === 0 && end.getUTCSeconds()   === 0
  );
}

// DELETE — photographer disconnects their own Google Calendar
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const memberRef = tenantRef.collection("team").doc(ctx.memberId);

  const snap = await tenantRef.collection("timeBlocks")
    .where("memberId", "==", ctx.memberId)
    .where("source",   "==", "google")
    .get();

  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.update(memberRef, { googleCalendar: null });
  await batch.commit();

  return Response.json({ ok: true });
}

// PATCH — save calendar ID setting (which Google calendar to sync)
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { calendarId } = await req.json().catch(() => ({}));
  const memberRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId);
  await memberRef.update({ "googleCalendar.calendarId": calendarId?.trim() || "primary" });
  return Response.json({ ok: true });
}

// POST — sync photographer's Google Calendar busy times into timeBlocks
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const memberRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(ctx.memberId);

  const memberDoc = await memberRef.get();
  if (!memberDoc.exists) return Response.json({ error: "Member not found" }, { status: 404 });

  const gcal = memberDoc.data().googleCalendar;
  if (!gcal?.refreshToken) {
    return Response.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  let accessToken    = gcal.accessToken;
  const calendarId   = gcal.calendarId?.trim() || "primary";

  if (!accessToken || (gcal.expiresAt && Date.now() > gcal.expiresAt - 60000)) {
    try {
      const refreshed = await refreshAccessToken(gcal.refreshToken);
      accessToken = refreshed.accessToken;
      await memberRef.update({
        "googleCalendar.accessToken": refreshed.accessToken,
        "googleCalendar.expiresAt":   refreshed.expiresAt,
      });
    } catch {
      return Response.json({ error: "Token refresh failed. Please reconnect Google Calendar." }, { status: 401 });
    }
  }

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });

  if (!fbRes.ok) {
    const err = await fbRes.json().catch(() => ({}));
    return Response.json({ error: err.error?.message || "Failed to fetch Google Calendar" }, { status: 502 });
  }

  const fbData        = await fbRes.json();
  const busyIntervals = fbData.calendars?.[calendarId]?.busy || fbData.calendars?.primary?.busy || [];

  const existingSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .where("memberId", "==", ctx.memberId)
    .where("source",   "==", "google")
    .get();

  const batch = adminDb.batch();
  existingSnap.docs.forEach((d) => batch.delete(d.ref));

  const newBlocks = [];
  for (const interval of busyIntervals) {
    const start       = new Date(interval.start);
    const end         = new Date(interval.end);
    const durationMin = (end - start) / 60000;
    if (durationMin < 15) continue;

    const allDay    = isAllDayBusy(start, end);
    const id        = uuidv4();
    const startDate = start.toISOString().slice(0, 10);
    // For all-day, freebusy end is exclusive (midnight of next day) — shift back one ms
    const endDate   = allDay ? new Date(end - 1).toISOString().slice(0, 10) : end.toISOString().slice(0, 10);

    const block = {
      id,
      memberId:  ctx.memberId,
      tenantId:  ctx.tenantId,
      startDate,
      endDate,
      allDay,
      startTime: allDay ? null : interval.start,
      endTime:   allDay ? null : interval.end,
      reason:    "Busy",
      note:      allDay ? "" : `${formatTime(start)} – ${formatTime(end)}`,
      source:    "google",
      createdAt: new Date(),
    };

    batch.set(
      adminDb.collection("tenants").doc(ctx.tenantId).collection("timeBlocks").doc(id),
      block
    );
    newBlocks.push({ id, memberId: ctx.memberId, startDate, endDate, allDay, reason: block.reason, note: block.note, source: "google" });
  }

  await batch.commit();

  return Response.json({ ok: true, synced: newBlocks.length, blocks: newBlocks });
}
