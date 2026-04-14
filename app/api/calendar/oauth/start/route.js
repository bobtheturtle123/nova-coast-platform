import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const token    = url.searchParams.get("token");
    const memberId = url.searchParams.get("memberId");

    if (!token || !memberId) {
      return Response.json({ error: "Missing params" }, { status: 400 });
    }

    // Verify the admin token
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const clientId    = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/oauth/callback`;

    if (!clientId) {
      return Response.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
    }

    // Store a temporary state to verify callback
    const state = Buffer.from(JSON.stringify({ tenantId: decoded.tenantId, memberId })).toString("base64url");

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
