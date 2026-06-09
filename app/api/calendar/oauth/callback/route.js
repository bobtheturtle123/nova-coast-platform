import { adminDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";
import { v4 as uuidv4 } from "uuid";

const DONE_HTML = (ok, msg = "") => `<!DOCTYPE html>
<html>
<head><title>Google Calendar ${ok ? "Connected" : "Error"}</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:2rem;max-width:360px">
    ${ok
      ? `<p style="font-size:2rem">✅</p><h2 style="color:#3486cf">Google Calendar connected!</h2><p style="color:#6b7280;font-size:.9rem">Syncing your availability…</p>`
      : `<p style="font-size:2rem">⚠️</p><h2 style="color:#dc2626">Connection failed</h2><p style="color:#6b7280;font-size:.9rem">${msg}</p>`
    }
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: ${ok ? '"gcal-connected"' : '"gcal-error"'}, error: ${ok ? "null" : JSON.stringify(msg)} }, "*");
      setTimeout(() => window.close(), 1200);
    } else {
      setTimeout(() => { window.location.href = "/dashboard/team${ok ? "?calSuccess=1" : ""}"; }, 1500);
    }
  </script>
</body>
</html>`;

function isAllDayBusy(start, end) {
  return (
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0 &&
    end.getUTCHours()   === 0 && end.getUTCMinutes()   === 0 && end.getUTCSeconds()   === 0
  );
}

// Sync a member's Google Calendar immediately after connecting
async function syncAfterConnect(tenantId, memberId, accessToken) {
  try {
    const { fetchBusyIntervals } = await import("@/lib/googleCalendar");
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const result = await fetchBusyIntervals(accessToken, "primary", timeMin, timeMax);
    if (result.error) return;
    const busy = result.items;

    const blocksRef = adminDb.collection("tenants").doc(tenantId).collection("timeBlocks");
    const existing  = await blocksRef.where("memberId", "==", memberId).where("source", "==", "google").get();

    const batch = adminDb.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));

    const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    for (const interval of busy) {
      const start = new Date(interval.start);
      const end   = new Date(interval.end);
      if ((end - start) / 60000 < 15) continue;
      const allDay    = interval.allDay ?? isAllDayBusy(start, end);
      const id        = uuidv4();
      const startDate = start.toISOString().slice(0, 10);
      const endDate   = allDay ? new Date(end - 1).toISOString().slice(0, 10) : end.toISOString().slice(0, 10);
      batch.set(blocksRef.doc(id), {
        id,
        memberId,
        tenantId,
        startDate,
        endDate,
        allDay,
        startTime: allDay ? null : interval.start,
        endTime:   allDay ? null : interval.end,
        reason:    interval.title || "Busy",
        eventTitle: interval.title || null,
        note:      allDay ? "All day" : `${fmt(start)} – ${fmt(end)}`,
        source:    "google",
        createdAt: new Date(),
      });
    }

    if (memberId === "__owner__") {
      batch.update(
        adminDb.collection("tenants").doc(tenantId),
        { "ownerGoogleCalendar.lastSynced": new Date().toISOString() }
      );
    } else {
      batch.update(
        adminDb.collection("tenants").doc(tenantId).collection("team").doc(memberId),
        { "googleCalendar.lastSynced": new Date().toISOString() }
      );
    }

    await batch.commit();
  } catch (e) {
    console.error("Auto-sync after OAuth connect failed:", e);
  }
}

export async function GET(req) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return new Response(DONE_HTML(false, error || "Missing parameters"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const { nonce } = JSON.parse(Buffer.from(state, "base64url").toString());
    if (!nonce) throw new Error("Invalid state");

    const nonceDoc = await adminDb.collection("oauthNonces").doc(nonce).get();
    if (!nonceDoc.exists) throw new Error("Invalid or expired OAuth state");

    const { tenantId, memberId, isOwnerFlow, expiresAt } = nonceDoc.data();
    const expiry = expiresAt?.toDate?.() || new Date(expiresAt);
    if (new Date() > expiry) {
      await nonceDoc.ref.delete();
      throw new Error("OAuth state expired. Please try again.");
    }
    await nonceDoc.ref.delete();

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Must exactly match the value used in /start AND registered in Google Cloud Console.
    const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${getAppUrl()}/api/calendar/oauth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const calData = {
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      connectedAt:  new Date().toISOString(),
    };

    if (isOwnerFlow) {
      // Store owner's personal Google Calendar on the tenant doc
      await adminDb.collection("tenants").doc(tenantId).update({ ownerGoogleCalendar: calData });
      syncAfterConnect(tenantId, "__owner__", tokens.access_token);
    } else {
      await adminDb
        .collection("tenants").doc(tenantId)
        .collection("team").doc(memberId)
        .update({ googleCalendar: calData });
      syncAfterConnect(tenantId, memberId, tokens.access_token);
    }

    return new Response(DONE_HTML(true), { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    console.error("Calendar OAuth callback error:", err);
    return new Response(DONE_HTML(false, err.message), { headers: { "Content-Type": "text/html" } });
  }
}
