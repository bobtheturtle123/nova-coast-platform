import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getTenantFromToken(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { uid: decoded.uid, tenantId: decoded.tenantId };
}

export async function PATCH(req) {
  try {
    const ctx = await getTenantFromToken(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Whitelist updatable fields
    const allowed = ["businessName", "phone", "fromZip", "branding", "pricingConfig", "bookingConfig", "emailTemplate", "travelFeeConfig"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    await adminDb.collection("tenants").doc(ctx.tenantId).update(update);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Tenant update error:", err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
