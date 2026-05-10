import { adminDb } from "@/lib/firebase-admin";
import { isSuperAdmin } from "@/lib/superadmin";

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

  // Return aggregate stats only — never return raw tenant objects
  return Response.json({
    totalTenants:  tenants.length,
    activeTenants,
    mrr,
    totalBookings: 0,
  });
}
