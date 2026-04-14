import { adminAuth, adminDb } from "@/lib/firebase-admin";

async function getTenantId(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  return decoded.tenantId || null;
}

// PATCH — update promo code
export async function PATCH(req, { params }) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const allowed = ["code", "type", "value", "usageLimit", "active", "expiresAt", "description"];
    const update = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (update.code) update.code = update.code.trim().toUpperCase();
    if (update.value) update.value = Number(update.value);
    if (update.usageLimit !== undefined) update.usageLimit = Number(update.usageLimit) || 0;

    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("promoCodes").doc(params.id)
      .update(update);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove promo code
export async function DELETE(req, { params }) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("promoCodes").doc(params.id)
      .delete();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
