import { adminDb } from "@/lib/firebase-admin";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("tenants").orderBy("createdAt", "desc").limit(500).get();

  // Return only fields needed for the admin panel — never return stripe keys, OAuth tokens, etc.
  const tenants = snap.docs.map((d) => {
    const t = d.data();
    return {
      id:                 d.id,
      businessName:       t.businessName,
      email:              t.email,
      slug:               t.slug,
      subscriptionStatus: t.subscriptionStatus,
      subscriptionPlan:   t.subscriptionPlan,
      permanentPlan:      t.permanentPlan || null,
      createdAt:          t.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return Response.json({ tenants });
}

// PATCH /api/superadmin/tenants — set permanentPlan (or any safe field) on a tenant
export async function PATCH(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tenantId, permanentPlan, subscriptionStatus } = body;
  if (!tenantId) return Response.json({ error: "tenantId required" }, { status: 400 });

  const allowed = ["solo", "studio", "pro", "scale", null];
  if (!allowed.includes(permanentPlan)) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  const update = {};
  if (permanentPlan !== undefined) {
    update.permanentPlan    = permanentPlan || null;
    update.subscriptionPlan = permanentPlan || "solo";
  }
  if (subscriptionStatus) update.subscriptionStatus = subscriptionStatus;

  await adminDb.collection("tenants").doc(tenantId).update(update);
  return Response.json({ ok: true });
}
