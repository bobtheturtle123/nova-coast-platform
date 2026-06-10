import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Status of the OWNER's personal Google Calendar connection (stored on the
// tenant doc as ownerGoogleCalendar). Tokens are never returned to the client.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("tenants").doc(decoded.tenantId).get();
  const cal = snap.data()?.ownerGoogleCalendar || null;
  const connected = !!(cal && (cal.refreshToken || cal.accessToken || cal.refresh_token || cal.access_token));

  return Response.json({
    connected,
    configured: !!process.env.GOOGLE_CLIENT_ID,
    lastSynced: cal?.lastSynced || null,
    email: cal?.email || null,
  });
}
