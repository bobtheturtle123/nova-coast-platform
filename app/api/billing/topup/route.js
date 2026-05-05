import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, TOPUP_PRICE_IDS } from "@/lib/stripe";
import { getAddonCaps, NEXT_PLAN, PLANS } from "@/lib/plans";
import { getAppUrl } from "@/lib/appUrl";

const TOPUP_CREDITS = { pack25: 25, pack50: 50, pack100: 100 };

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { uid: decoded.uid, tenantId: decoded.tenantId };
}

export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { pack } = await req.json();
    const priceId = TOPUP_PRICE_IDS[pack];
    const credits = TOPUP_CREDITS[pack];
    if (!priceId || !credits) return Response.json({ error: "Invalid pack" }, { status: 400 });

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data();

    // Enforce per-plan topup cap
    const planId      = tenant.subscriptionPlan || "solo";
    const caps        = getAddonCaps(planId);
    const currentTopup = tenant.addonListings || 0;

    if (caps.topupListings !== null) {
      if (currentTopup >= caps.topupListings) {
        const nextPlanId   = NEXT_PLAN[planId];
        const nextPlanName = nextPlanId ? PLANS[nextPlanId]?.name : null;
        return Response.json({
          error: `Your ${PLANS[planId]?.name} plan has reached its listing credit expansion limit (${caps.topupListings} credits). ${nextPlanName ? `Upgrade to ${nextPlanName} for more capacity.` : ""}`,
          upgradeRequired: true,
          nextPlan: nextPlanId,
        }, { status: 403 });
      }
      if (currentTopup + credits > caps.topupListings) {
        const remaining = caps.topupListings - currentTopup;
        const nextPlanId   = NEXT_PLAN[planId];
        const nextPlanName = nextPlanId ? PLANS[nextPlanId]?.name : null;
        return Response.json({
          error: `This pack would exceed your plan's limit. You can add up to ${remaining} more credits on your current plan. ${nextPlanName ? `Upgrade to ${nextPlanName} to expand further.` : ""}`,
          upgradeRequired: true,
          nextPlan: nextPlanId,
        }, { status: 403 });
      }
    }

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name:  tenant.businessName,
        metadata: { tenantId: ctx.tenantId },
      });
      customerId = customer.id;
      await adminDb.collection("tenants").doc(ctx.tenantId).update({ stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode:       "payment",
      customer:   customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getAppUrl()}/dashboard/billing?topup=success`,
      cancel_url:  `${getAppUrl()}/dashboard/billing`,
      metadata: { tenantId: ctx.tenantId, type: "topup", pack },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Top-up error:", err);
    return Response.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
