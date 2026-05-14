import { adminDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";

const DONE_HTML = (ok, msg = "") => `<!DOCTYPE html>
<html>
<head><title>Google Calendar ${ok ? "Connected" : "Error"}</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:2rem;max-width:360px">
    ${ok
      ? `<p style="font-size:2rem">✅</p><h2 style="color:#3486cf">Google Calendar connected!</h2><p style="color:#6b7280;font-size:.9rem">You can close this window.</p>`
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

    const { tenantId, memberId, expiresAt } = nonceDoc.data();
    const expiry = expiresAt?.toDate?.() || new Date(expiresAt);
    if (new Date() > expiry) {
      await nonceDoc.ref.delete();
      throw new Error("OAuth state expired. Please try again.");
    }

    await nonceDoc.ref.delete();

    const appUrl = getAppUrl();
    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri  = `${appUrl}/api/calendar/oauth/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
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

    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("team").doc(memberId)
      .update({
        googleCalendar: {
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          expiresAt:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
          connectedAt:  new Date().toISOString(),
        },
      });

    return new Response(DONE_HTML(true), { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    console.error("Calendar OAuth callback error:", err);
    return new Response(DONE_HTML(false, err.message), { headers: { "Content-Type": "text/html" } });
  }
}
