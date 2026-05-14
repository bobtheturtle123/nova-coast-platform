export const dynamic = "force-dynamic";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(req) {
  try {
    const url   = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Derive memberId from token claims — never trust query param
    // This prevents a user from connecting their Google account to a different member's record
    let memberId = decoded.memberId || null;

    const teamRef = adminDb.collection("tenants").doc(decoded.tenantId).collection("team");

    if (!memberId && decoded.uid) {
      const snap = await teamRef.where("uid", "==", decoded.uid).limit(1).get();
      if (!snap.empty) memberId = snap.docs[0].id;
    }
    if (!memberId && decoded.email) {
      const snap = await teamRef.where("email", "==", decoded.email.toLowerCase()).limit(1).get();
      if (!snap.empty) memberId = snap.docs[0].id;
    }

    if (!memberId) {
      return Response.json(
        { error: "Team member profile not found. Ask your admin to add you to the team first." },
        { status: 404 }
      );
    }

    // Verify member belongs to this tenant (safety check)
    const memberDoc = await teamRef.doc(memberId).get();
    if (!memberDoc.exists) return Response.json({ error: "Team member not found" }, { status: 404 });

    const clientId   = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${getAppUrl()}/api/calendar/oauth/callback`;

    if (!clientId) {
      return Response.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
    }

    // Preflight check only — no redirect
    if (url.searchParams.get("preflight") === "1") {
      return Response.json({ ok: true });
    }

    const nonce = randomBytes(24).toString("hex");
    await adminDb.collection("oauthNonces").doc(nonce).set({
      tenantId:  decoded.tenantId,
      memberId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const state = Buffer.from(JSON.stringify({ nonce })).toString("base64url");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id",     clientId);
    authUrl.searchParams.set("redirect_uri",  redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope",         "https://www.googleapis.com/auth/calendar");
    authUrl.searchParams.set("access_type",   "offline");
    authUrl.searchParams.set("prompt",        "consent");
    authUrl.searchParams.set("state",         state);

    return Response.redirect(authUrl.toString());
  } catch (err) {
    console.error("Calendar OAuth start error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
