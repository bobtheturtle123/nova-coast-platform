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

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const creds = tenantDoc.data()?.cubiCasaCredentials;
  if (!creds?.email) {
    return Response.json({ error: "not_connected", message: "CubiCasa account not connected." }, { status: 403 });
  }

  // Return orders received via CubiCasa webhook (stored locally)
  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("cubicasaOrders")
    .orderBy("receivedAt", "desc")
    .limit(100)
    .get();

  const orders = snap.docs.map((d) => {
    const o = d.data();
    return {
      id:                         o.orderId,
      address:                    o.address || "",
      createdAt:                  o.receivedAt?.toDate?.()?.toISOString?.() || null,
      status:                     o.status || null,
      floorPlanUrl:               o.floorPlanUrl || null,
      floorPlanWithDimensionsUrl: o.floorPlanWithDimensionsUrl || null,
    };
  });

  return Response.json(orders);
}

// DELETE — disconnect
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ cubiCasaCredentials: null });
  return Response.json({ ok: true });
}
