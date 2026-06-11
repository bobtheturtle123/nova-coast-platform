import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Returns which members (incl. the owner) have Google Calendar connected, as a
// list of IDs only — never tokens. Used by the team page to auto-sync on load.
async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const [tenantDoc, teamSnap] = await Promise.all([
    tenantRef.get(),
    tenantRef.collection("team").get(),
  ]);

  const ids = [];
  if (tenantDoc.data()?.ownerGoogleCalendar?.refreshToken) ids.push("__owner__");
  teamSnap.docs.forEach((d) => {
    if (d.data()?.googleCalendar?.refreshToken) ids.push(d.id);
  });

  return Response.json({ ids });
}
