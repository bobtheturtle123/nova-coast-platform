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

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const galleries = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    mediaCount: (d.data().media || []).length,
  }));

  return Response.json({ galleries });
}
