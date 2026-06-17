import { adminDb } from "@/lib/firebase-admin";
import { isUnlimitedTenant } from "@/lib/plans";

// Server-side subscription gate. The dashboard UI redirects unpaid accounts to
// /auth/plan, but that is client-side and bypassable — any route that consumes
// real resources (creates bookings/listings, invites team, calls the LLM, etc.)
// must independently confirm the tenant is paid. Returns true when the tenant
// has an active/lifetime/unlimited plan; false otherwise.
export async function tenantHasActivePlan(tenantId) {
  if (!tenantId) return false;
  const doc = await adminDb.collection("tenants").doc(tenantId).get();
  if (!doc.exists) return false;
  const t = doc.data();
  if (isUnlimitedTenant(t)) return true;
  if (t.permanentPlan) return true;
  // A real Stripe subscription that hasn't been canceled counts (includes
  // "active", "trialing", "past_due" — past_due keeps a short grace window).
  if (t.stripeSubscriptionId && t.subscriptionStatus !== "canceled") return true;
  return false;
}

// Convenience: standard 402 response for unpaid access attempts.
export function paymentRequired() {
  return Response.json(
    { error: "An active subscription is required to use this feature." },
    { status: 402 }
  );
}
