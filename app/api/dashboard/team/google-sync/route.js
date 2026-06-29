import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { fetchBusyIntervals } from "@/lib/googleCalendar";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    const role = decoded.role || (decoded.memberId ? "photographer" : "owner");
    if (!decoded.tenantId || !["owner", "admin", "manager"].includes(role)) return null;
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

// PATCH { memberId, calendarId?, syncEnabled? } — set which calendar to sync
// and/or turn a member's calendar events on/off (admin control).
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, calendarId, syncEnabled } = await req.json().catch(() => ({}));
  if (!memberId) return Response.json({ error: "memberId required" }, { status: 400 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const update = {};
  if (calendarId !== undefined) update["googleCalendar.calendarId"] = (calendarId || "").trim() || "primary";
  if (syncEnabled !== undefined) update["googleCalendar.syncEnabled"] = !!syncEnabled;
  if (!Object.keys(update).length) return Response.json({ error: "Nothing to update" }, { status: 400 });

  if (memberId === "__owner__") {
    const ownerUpdate = {};
    for (const k of Object.keys(update)) ownerUpdate[k.replace("googleCalendar.", "ownerGoogleCalendar.")] = update[k];
    await tenantRef.update(ownerUpdate);
  } else {
    await tenantRef.collection("team").doc(memberId).update(update);
  }

  return Response.json({ ok: true });
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
    batch.update(tenantRef, { ownerGoogleCalendar: FieldValue.delete() });
  } else {
    batch.update(tenantRef.collection("team").doc(memberId), { googleCalendar: FieldValue.delete() });
  }

  await batch.commit();
  return Response.json({ ok: true });
}

const SYNC_RATE_LIMIT   = 5;  // max manual syncs per member per hour
const SYNC_WINDOW_MS    = 60 * 60 * 1000;

// POST { memberId } — admin-triggered Google Calendar sync. Use memberId "__owner__" for the tenant owner.
export async function POST(req) {
  try {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { memberId, _cron } = body;
  if (!memberId) return Response.json({ error: "memberId required" }, { status: 400 });

  // Rate-limit manual syncs (skip for cron-triggered calls)
  if (!_cron) {
    const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
    // Firestore rejects doc IDs matching __.*__ — sanitize "__owner__" → "owner"
    const rateDocId  = memberId.replace(/^__(.+)__$/, "$1");
    const rateRef    = tenantRef.collection("syncRateLimits").doc(rateDocId);
    const rateSnap  = await rateRef.get();
    const now       = Date.now();
    const recent    = (rateSnap.data()?.timestamps || []).filter((t) => now - t < SYNC_WINDOW_MS);
    if (recent.length >= SYNC_RATE_LIMIT) {
      return Response.json({ error: `Sync limit reached — max ${SYNC_RATE_LIMIT} syncs per hour. Try again later.` }, { status: 429 });
    }
    await rateRef.set({ timestamps: [...recent, now] }, { merge: true });
  }

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

  // Fetch real events (with titles + times) via the Events API. Falls back to
  // freeBusy for members who connected under the old calendar.freebusy scope
  // (their token can't read events until they reconnect).
  const intervals = await fetchBusyIntervals(accessToken, calendarId, timeMin, timeMax);
  if (intervals.error) {
    return Response.json({ error: intervals.error }, { status: 502 });
  }

  const existingSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .where("memberId", "==", memberId)
    .where("source", "==", "google")
    .get();

  const batch = adminDb.batch();
  existingSnap.docs.forEach((d) => batch.delete(d.ref));

  const newBlocks = [];
  for (const interval of intervals.items) {
    const start       = new Date(interval.start);
    const end         = new Date(interval.end);
    const durationMin = (end - start) / 60000;
    if (durationMin < 15) continue;

    const allDay    = interval.allDay ?? isAllDayBusy(start, end);
    const id        = uuidv4();
    const startDate = start.toISOString().slice(0, 10);
    const endDate   = allDay ? new Date(end - 1).toISOString().slice(0, 10) : end.toISOString().slice(0, 10);
    const title     = interval.title || "Busy";

    const block = {
      id,
      memberId,
      tenantId:  ctx.tenantId,
      startDate,
      endDate,
      allDay,
      startTime: allDay ? null : interval.start,
      endTime:   allDay ? null : interval.end,
      reason:    title,
      eventTitle: interval.title || null,
      note:      allDay ? "All day" : `${formatTime(start)} – ${formatTime(end)}`,
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
  } catch (err) {
    console.error("[google-sync] POST error:", err);
    return Response.json({ error: err?.message || "Sync failed unexpectedly" }, { status: 500 });
  }
}
