export const dynamic = "force-dynamic";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const token    = url.searchParams.get("token");
    const memberId = url.searchParams.get("memberId");

    if (!token || !memberId) {
      return Response.json({ error: "Missing params" }, { status: 400 });
    }

    // Verify the admin token — tenantId comes from verified claims, not from query params
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Verify the memberId belongs to this tenant
    const memberDoc = await adminDb
      .collection("tenants").doc(decoded.tenantId)
      .collection("team").doc(memberId)
      .get();
    if (!memberDoc.exists) return Response.json({ error: "Team member not found" }, { status: 404 });

    const clientId    = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${getAppUrl()}/api/calendar/oauth/callback`;

    if (!clientId) {
      return Response.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
    }

    // Preflight — validate config without redirecting
    if (url.searchParams.get("preflight") === "1") {
      return Response.json({ ok: true });
    }

    // Generate a cryptographically random nonce and store it server-side
    // The callback will verify this nonce — prevents state forgery
    const nonce = randomBytes(24).toString("hex");
    await adminDb.collection("oauthNonces").doc(nonce).set({
      tenantId:  decoded.tenantId,
      memberId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10-minute expiry
    });

    // State contains only the nonce — tenantId/memberId are looked up server-side in callback
    const state = Buffer.from(JSON.stringify({ nonce })).toString("base64url");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString());
  } catch (err) {
    console.error("Calendar OAuth start error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
