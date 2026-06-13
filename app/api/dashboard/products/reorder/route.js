import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const ALLOWED = ["packages", "services", "addons", "retainers"];

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

// POST { type, orderedIds } — persist display order via a sortOrder index.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { type, orderedIds } = await req.json().catch(() => ({}));
  if (!ALLOWED.includes(type) || !Array.isArray(orderedIds)) {
    return Response.json({ error: "type and orderedIds required" }, { status: 400 });
  }

  const coll  = adminDb.collection("tenants").doc(ctx.tenantId).collection(type);
  const batch = adminDb.batch();
  orderedIds.slice(0, 500).forEach((id, i) => {
    if (id) batch.update(coll.doc(String(id)), { sortOrder: i });
  });
  await batch.commit();
  return Response.json({ ok: true });
}
