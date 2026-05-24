import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId || !["owner", "admin", "manager"].includes(decoded.role)) return null;
    return { tenantId: decoded.tenantId };
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

function isAllDayBusy(start, end) {
  return (
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0 &&
    end.getUTCHours()   === 0 && end.getUTCMinutes()   === 0 && end.getUTCSeconds()   === 0
  );
}

// DELETE { memberId } — admin removes a member's Google Calendar connection + clears google blocks
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await req.json().catch(() => ({}));
  if (!memberId) return Response.json({ error: "memberId required" }, { status: 400 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  const snap = await tenantRef.collection("timeBlocks")
    .where("memberId", "==", memberId)
    .where("source",   "==", "google")
    .get();

  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));

  if (memberId === "__owner__") {
    batch.update(tenantRef, { ownerGoogleCalendar: null });
  } else {
    batch.update(tenantRef.collection("team").doc(memberId), { googleCalendar: null });
  }

  await batch.commit();
  return Response.json({ ok: true });
}

// POST { memberId } — admin-triggered Google Calendar sync. Use memberId "__owner__" for the tenant owner.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { memberId } = body;
  if (!memberId) return Response.json({ error: "memberId required" }, { status: 400 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  let gcal, accessToken, updateTokens;

  if (memberId === "__owner__") {
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) return Response.json({ error: "Tenant not found" }, { status: 404 });
    gcal = tenantDoc.data().ownerGoogleCalendar;
    if (!gcal?.refreshToken) {
      return Response.json({ error: "Google Calendar not connected for this member" }, { status: 400 });
    }
    updateTokens = async (refreshed) => {
      await tenantRef.update({
        "ownerGoogleCalendar.accessToken": refreshed.accessToken,
        "ownerGoogleCalendar.expiresAt":   refreshed.expiresAt,
      });
    };
  } else {
    const memberRef = tenantRef.collection("team").doc(memberId);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) return Response.json({ error: "Member not found" }, { status: 404 });
    gcal = memberDoc.data().googleCalendar;
    if (!gcal?.refreshToken) {
      return Response.json({ error: "Google Calendar not connected for this member" }, { status: 400 });
    }
    updateTokens = async (refreshed) => {
      await memberRef.update({
        "googleCalendar.accessToken": refreshed.accessToken,
        "googleCalendar.expiresAt":   refreshed.expiresAt,
      });
    };
  }

  accessToken = gcal.accessToken;
  const calendarId = gcal.calendarId?.trim() || "primary";

  if (!accessToken || (gcal.expiresAt && Date.now() > gcal.expiresAt - 60000)) {
    try {
      const refreshed = await refreshAccessToken(gcal.refreshToken);
      accessToken = refreshed.accessToken;
      await updateTokens(refreshed);
    } catch (err) {
      return Response.json({ error: "Token refresh failed. Member may need to reconnect Google Calendar." }, { status: 401 });
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
    .where("memberId", "==", memberId)
    .where("source", "==", "google")
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
    const endDate   = allDay ? new Date(end - 1).toISOString().slice(0, 10) : end.toISOString().slice(0, 10);

    const block = {
      id,
      memberId,
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
    newBlocks.push({ id, startDate, endDate, allDay, reason: block.reason, note: block.note });
  }

  // Record last sync time
  if (memberId === "__owner__") {
    batch.update(tenantRef, { "ownerGoogleCalendar.lastSynced": new Date().toISOString() });
  } else {
    batch.update(tenantRef.collection("team").doc(memberId), { "googleCalendar.lastSynced": new Date().toISOString() });
  }

  await batch.commit();

  return Response.json({ ok: true, synced: newBlocks.length, blocks: newBlocks });
}
