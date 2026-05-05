import { adminDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(req) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = getAppUrl();

  if (error || !code || !state) {
    return Response.redirect(`${appUrl}/dashboard/team?calError=denied`);
  }

  try {
    // Decode state and extract nonce
    const { nonce } = JSON.parse(Buffer.from(state, "base64url").toString());
    if (!nonce) throw new Error("Invalid state");

    // Verify nonce against server-side store (prevents state forgery)
    const nonceDoc = await adminDb.collection("oauthNonces").doc(nonce).get();
    if (!nonceDoc.exists) throw new Error("Invalid or expired OAuth state");

    const { tenantId, memberId, expiresAt } = nonceDoc.data();
    const expiry = expiresAt?.toDate?.() || new Date(expiresAt);
    if (new Date() > expiry) {
      await nonceDoc.ref.delete();
      throw new Error("OAuth state expired. Please try again.");
    }

    // Consume the nonce (one-time use)
    await nonceDoc.ref.delete();

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri  = `${appUrl}/api/calendar/oauth/callback`;

    // Exchange code for tokens
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

    // Store tokens scoped to the verified tenant + member
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

    return Response.redirect(`${appUrl}/dashboard/team?calSuccess=1`);
  } catch (err) {
    console.error("Calendar OAuth callback error:", err);
    return Response.redirect(`${appUrl}/dashboard/team?calError=${encodeURIComponent(err.message)}`);
  }
}
