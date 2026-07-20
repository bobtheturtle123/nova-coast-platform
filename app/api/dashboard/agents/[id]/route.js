import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sanitizePartnerDiscount } from "@/lib/partnerDiscount";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["name", "email", "phone", "notes", "company"];
  const update = {};
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  // Partner pricing for this individual agent (a team-wide rate lives on the
  // customer team instead). Sanitized — it reduces what clients are charged.
  if (body.partnerDiscount !== undefined) {
    const { value, error } = sanitizePartnerDiscount(body.partnerDiscount);
    if (error) return Response.json({ error }, { status: 400 });
    update.partnerDiscount = value;
  }

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("agents").doc(params.id)
    .update(update);

  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("agents").doc(params.id)
    .delete();

  return Response.json({ ok: true });
}
