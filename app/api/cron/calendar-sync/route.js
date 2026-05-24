import { adminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

function isAllDayBusy(start, end) {
  return (
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0 &&
    end.getUTCHours()   === 0 && end.getUTCMinutes()   === 0 && end.getUTCSeconds()   === 0
  );
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

async function refreshToken(refreshToken) {
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

async function syncMember({ tenantId, memberId, gcal, updateTokenFn }) {
  let accessToken = gcal.accessToken;
  if (!accessToken || (gcal.expiresAt && Date.now() > gcal.expiresAt - 60000)) {
    if (!gcal.refreshToken) throw new Error("No refresh token");
    const refreshed = await refreshToken(gcal.refreshToken);
    accessToken = refreshed.accessToken;
    await updateTokenFn(refreshed);
  }

  const calendarId = gcal.calendarId?.trim() || "primary";
  const timeMin    = new Date().toISOString();
  const timeMax    = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!fbRes.ok) throw new Error(`freeBusy failed: ${fbRes.status}`);

  const fbData  = await fbRes.json();
  const busy    = fbData.calendars?.[calendarId]?.busy || fbData.calendars?.primary?.busy || [];

  const blocksRef = adminDb.collection("tenants").doc(tenantId).collection("timeBlocks");
  const existing  = await blocksRef.where("memberId", "==", memberId).where("source", "==", "google").get();

  const batch = adminDb.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));

  for (const interval of busy) {
    const start = new Date(interval.start);
    const end   = new Date(interval.end);
    if ((end - start) / 60000 < 15) continue;

    const allDay    = isAllDayBusy(start, end);
    const id        = uuidv4();
    const startDate = start.toISOString().slice(0, 10);
    const endDate   = allDay ? new Date(end - 1).toISOString().slice(0, 10) : end.toISOString().slice(0, 10);

    batch.set(blocksRef.doc(id), {
      id, memberId, tenantId, startDate, endDate, allDay,
      startTime: allDay ? null : interval.start,
      endTime:   allDay ? null : interval.end,
      reason:    "Busy",
      note:      allDay ? "" : `${formatTime(start)} – ${formatTime(end)}`,
      source:    "google",
      createdAt: new Date(),
    });
  }

  await batch.commit();
  return busy.length;
}

// GET — called by Vercel Cron every 12 hours
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenantsSnap = await adminDb.collection("tenants").get();
  let synced = 0;
  let errors = 0;

  await Promise.allSettled(
    tenantsSnap.docs.map(async (tenantDoc) => {
      const tenantId   = tenantDoc.id;
      const tenantData = tenantDoc.data();
      const tenantRef  = adminDb.collection("tenants").doc(tenantId);

      // Sync owner
      const ownerGcal = tenantData.ownerGoogleCalendar;
      if (ownerGcal?.refreshToken) {
        try {
          await syncMember({
            tenantId, memberId: "__owner__", gcal: ownerGcal,
            updateTokenFn: async (r) => tenantRef.update({
              "ownerGoogleCalendar.accessToken": r.accessToken,
              "ownerGoogleCalendar.expiresAt":   r.expiresAt,
              "ownerGoogleCalendar.lastSynced":  new Date().toISOString(),
            }),
          });
          await tenantRef.update({ "ownerGoogleCalendar.lastSynced": new Date().toISOString() });
          synced++;
        } catch (e) {
          console.error(`[cron/calendar-sync] owner sync failed for tenant ${tenantId}:`, e.message);
          errors++;
        }
      }

      // Sync team members
      const membersSnap = await tenantRef.collection("team").get();
      await Promise.allSettled(
        membersSnap.docs.map(async (memberDoc) => {
          const gcal = memberDoc.data().googleCalendar;
          if (!gcal?.refreshToken) return;
          const memberId  = memberDoc.id;
          const memberRef = tenantRef.collection("team").doc(memberId);
          try {
            await syncMember({
              tenantId, memberId, gcal,
              updateTokenFn: async (r) => memberRef.update({
                "googleCalendar.accessToken": r.accessToken,
                "googleCalendar.expiresAt":   r.expiresAt,
              }),
            });
            await memberRef.update({ "googleCalendar.lastSynced": new Date().toISOString() });
            synced++;
          } catch (e) {
            console.error(`[cron/calendar-sync] member ${memberId} sync failed:`, e.message);
            errors++;
          }
        })
      );
    })
  );

  return Response.json({ ok: true, synced, errors });
}
