import { adminDb, adminAuth } from "@/lib/firebase-admin";

// Hardcoded UID allowlist loaded from env var: SUPERADMIN_UIDS=uid1,uid2
// Falls back to role claim only if env var not set (legacy).
function getSuperAdminUids() {
  const raw = process.env.SUPERADMIN_UIDS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function isSuperAdmin(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "superadmin") return false;

    // If SUPERADMIN_UIDS is set, require the user to be in the allowlist
    const allowlist = getSuperAdminUids();
    if (allowlist.length > 0 && !allowlist.includes(decoded.uid)) return false;

    return true;
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

  // Return aggregate stats only — never return raw tenant objects
  return Response.json({
    totalTenants:  tenants.length,
    activeTenants,
    mrr,
    totalBookings: 0,
  });
}
