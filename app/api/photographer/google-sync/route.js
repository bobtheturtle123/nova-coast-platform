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

  let accessToken = gcal.accessToken;

  // Refresh token if expired or missing
  if (!accessToken || (gcal.expiresAt && Date.now() > gcal.expiresAt - 60000)) {
    try {
      const refreshed = await refreshAccessToken(gcal.refreshToken);
      accessToken = refreshed.accessToken;
      await memberRef.update({
        "googleCalendar.accessToken": refreshed.accessToken,
        "googleCalendar.expiresAt":   refreshed.expiresAt,
      });
    } catch (err) {
      return Response.json({ error: "Token refresh failed. Please reconnect Google Calendar." }, { status: 401 });
    }
  }

  // Fetch busy times for next 90 days
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });

  if (!fbRes.ok) {
    const err = await fbRes.json().catch(() => ({}));
    return Response.json({ error: err.error?.message || "Failed to fetch Google Calendar" }, { status: 502 });
  }

  const fbData = await fbRes.json();
  const busyIntervals = fbData.calendars?.primary?.busy || [];

  // Delete existing google-synced blocks for this member
  const existingSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .where("memberId", "==", ctx.memberId)
    .where("source", "==", "google")
    .get();

  const batch = adminDb.batch();
  existingSnap.docs.forEach((d) => batch.delete(d.ref));

  // Write new blocks — one per busy interval (no event names, just times)
  const newBlocks = [];
  for (const interval of busyIntervals) {
    const start = new Date(interval.start);
    const end   = new Date(interval.end);

    const startDate = start.toISOString().slice(0, 10);
    const endDate   = end.toISOString().slice(0, 10);

    // Skip very short intervals (< 15 min) — likely reminders
    const durationMin = (end - start) / 60000;
    if (durationMin < 15) continue;

    const id = uuidv4();
    const block = {
      id,
      memberId:  ctx.memberId,
      tenantId:  ctx.tenantId,
      startDate,
      endDate,
      startTime: interval.start,
      endTime:   interval.end,
      reason:    "Busy",
      note:      `${formatTime(start)} – ${formatTime(end)}`,
      source:    "google",
      createdAt: new Date(),
    };

    batch.set(
      adminDb.collection("tenants").doc(ctx.tenantId).collection("timeBlocks").doc(id),
      block
    );
    newBlocks.push({ id, memberId: block.memberId, startDate, endDate, reason: block.reason, note: block.note, source: "google" });
  }

  await batch.commit();

  return Response.json({ ok: true, synced: newBlocks.length, blocks: newBlocks });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
