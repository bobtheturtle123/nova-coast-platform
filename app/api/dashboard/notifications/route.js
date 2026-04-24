import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// GET — fetch notification prefs
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const prefs = doc.exists ? (doc.data().notificationPrefs || {}) : {};
  return Response.json({ prefs });
}

// PATCH — save notification prefs
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    notificationPrefs: body.prefs,
    updatedAt: new Date(),
  });
  return Response.json({ ok: true });
}
