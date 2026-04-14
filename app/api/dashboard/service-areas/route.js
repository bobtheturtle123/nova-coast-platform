import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { tenantId: decoded.tenantId };
}

export async function GET(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const snap = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("serviceAreas").orderBy("createdAt", "desc").get();

    const zones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ zones });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, type, color, assignedTo, notes, paths } = body;

    const ref = adminDb.collection("tenants").doc(ctx.tenantId).collection("serviceAreas").doc();
    const zone = {
      id: ref.id,
      name:       name       || "Unnamed Zone",
      type:       type       || "include",
      color:      color      || "#3B82F6",
      assignedTo: assignedTo || [],
      notes:      notes      || "",
      paths:      paths      || [],
      createdAt:  new Date(),
    };
    await ref.set(zone);
    return Response.json({ zone: { ...zone, createdAt: zone.createdAt.toISOString() } });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}
