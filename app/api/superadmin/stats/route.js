import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function isSuperAdmin(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    return decoded.role === "superadmin";
  } catch { return false; }
}

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantsSnap = await adminDb.collection("tenants").get();
  const tenants = tenantsSnap.docs.map((d) => d.data());

  const PLAN_PRICES = { starter: 49, pro: 99, agency: 199 };

  const activeTenants = tenants.filter((t) =>
    t.subscriptionStatus === "active" || t.subscriptionStatus === "trialing"
  ).length;

  const mrr = tenants
    .filter((t) => t.subscriptionStatus === "active")
    .reduce((sum, t) => sum + (PLAN_PRICES[t.subscriptionPlan] || 0), 0);

  return Response.json({
    totalTenants: tenants.length,
    activeTenants,
    totalBookings: 0, // Would need cross-tenant query — expensive; skip for now
    mrr,
  });
}
