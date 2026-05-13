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

  const doc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ tenant: doc.data() });
}

// Allowed top-level tenant settings fields that can be updated via this route
const PATCHABLE_FIELDS = new Set(["cubiCasaApiKey", "emailTemplate", "smsSettings"]);

export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update = {};
  for (const [k, v] of Object.entries(body)) {
    if (PATCHABLE_FIELDS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await adminDb.collection("tenants").doc(ctx.tenantId).update(update);
  return Response.json({ ok: true });
}
