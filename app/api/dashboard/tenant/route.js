import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { isSuperAdminEmail } from "@/lib/plans";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member", email: decoded.email || "" };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  let tenant = doc.data();

  // Owner / super-admin accounts get the free lifetime unlimited plan. Stamp it
  // on the doc (once) keyed off the authenticated email, so every limit check and
  // the UI see "unlimited" regardless of what was stored at signup.
  if ((isSuperAdminEmail(ctx.email) || ctx.role === "superadmin") &&
      (tenant.unlimited !== true || tenant.permanentPlan !== "scale")) {
    try {
      await doc.ref.update({ unlimited: true, permanentPlan: "scale" });
      tenant = { ...tenant, unlimited: true, permanentPlan: "scale" };
    } catch { /* non-fatal */ }
  }

  return Response.json({ tenant });
}

// Allowed top-level tenant settings fields that can be updated via this route
const PATCHABLE_FIELDS = new Set(["emailTemplate", "smsSettings", "calendarBlockSync"]);

export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

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
