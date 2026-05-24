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

// GET /api/dashboard/catalog — returns all packages, services, and addons
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  const [pkgSnap, svcSnap, addonSnap] = await Promise.all([
    tenantRef.collection("packages").get(),
    tenantRef.collection("services").get(),
    tenantRef.collection("addons").get(),
  ]);

  return Response.json({
    packages: pkgSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    services: svcSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    addons:   addonSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}
