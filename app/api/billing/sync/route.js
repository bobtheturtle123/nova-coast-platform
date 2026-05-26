import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// Syncs subscription status from Stripe into Firestore.
// Called automatically when the dashboard gate blocks a tenant who has a Stripe customer
// but no recorded subscription — recovers from missed webhook events.
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
  const tenantSnap = await tenantRef.get();
  const tenant     = tenantSnap.data();

  if (!tenant?.stripeCustomerId) {
    return Response.json({ synced: false, reason: "no_customer" });
  }

  let activeSub = null;
  try {
    const subs = await stripe.subscriptions.list({
      customer: tenant.stripeCustomerId,
      status:   "all",
      limit:    5,
    });
    activeSub = subs.data.find((s) =>
      s.status === "active" || s.status === "trialing" || s.status === "past_due"
    ) || subs.data[0] || null;
  } catch (err) {
    console.error("[billing/sync] Stripe list error:", err?.message);
    return Response.json({ synced: false, reason: "stripe_error" }, { status: 500 });
  }

  if (!activeSub) {
    return Response.json({ synced: false, reason: "no_subscription" });
  }

  const plan = activeSub.metadata?.plan || "solo";
  await tenantRef.update({
    stripeSubscriptionId:  activeSub.id,
    subscriptionStatus:    activeSub.status,
    subscriptionPlan:      plan,
    subscriptionRenewalAt: activeSub.current_period_end
      ? new Date(activeSub.current_period_end * 1000)
      : null,
  });

  console.log(`[billing/sync] synced tenant=${ctx.tenantId} sub=${activeSub.id} plan=${plan}`);
  return Response.json({ synced: true, plan, status: activeSub.status });
}
