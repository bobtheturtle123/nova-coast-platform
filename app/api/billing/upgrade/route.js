import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";
import { notifyTenant } from "@/lib/notify";
import { sendPlanChangeEmail } from "@/lib/email";

const PLAN_ORDER = ["solo", "studio", "pro", "scale"];

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  if (decoded.role && decoded.role !== "admin" && decoded.role !== "owner") return null;
  return { uid: decoded.uid, tenantId: decoded.tenantId };
}

// POST /api/billing/upgrade
// Directly updates the Stripe subscription to a new plan (handles proration automatically).
// Used for both upgrades and downgrades — no need to open the Stripe portal.
export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { plan } = await req.json();
    const newPriceId = PLAN_PRICE_IDS[plan];
    if (!newPriceId) return Response.json({ error: "Invalid plan" }, { status: 400 });

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data();

    if (!tenant?.stripeSubscriptionId) {
      return Response.json({ error: "No active subscription found" }, { status: 400 });
    }

    // Retrieve the current subscription to get the current item ID
    const sub = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    // Find the main plan item (not addon seats)
    const mainItem = sub.items.data.find((item) => {
      const pid = item.price?.id;
      return Object.values(PLAN_PRICE_IDS).includes(pid);
    }) || sub.items.data[0];

    if (!mainItem) {
      return Response.json({ error: "Could not find subscription item to update" }, { status: 400 });
    }

    const currentPlan = tenant.subscriptionPlan || null;
    const isUpgrade = PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan);

    // Update the subscription. For UPGRADES we invoice the prorated difference
    // immediately (always_invoice) and require the payment to succeed now
    // (error_if_incomplete) — otherwise the customer would get the higher plan
    // without being charged until the next cycle (effectively free). Downgrades
    // create a proration credit applied to the next invoice.
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      items: [{ id: mainItem.id, price: newPriceId }],
      proration_behavior: isUpgrade ? "always_invoice" : "create_prorations",
      payment_behavior:   isUpgrade ? "error_if_incomplete" : "allow_incomplete",
      metadata: { plan, tenantId: ctx.tenantId },
    });

    // Only reached if the (immediate) charge succeeded for upgrades.
    await adminDb.collection("tenants").doc(ctx.tenantId).update({
      subscriptionPlan: plan,
    });

    // Notify the tenant (in-app + email). Best-effort.
    const planName  = PLANS[plan]?.name || plan;
    const priceText = PLANS[plan]?.monthlyPrice != null ? `$${PLANS[plan].monthlyPrice}/mo` : "";
    notifyTenant(ctx.tenantId, {
      type: "billing",
      title: `Plan ${isUpgrade ? "upgraded" : "changed"} to ${planName}`,
      body: isUpgrade ? `The prorated difference was charged to your card. You're now on ${planName}.` : `You're now on ${planName}.`,
      link: "/dashboard/billing",
    }).catch(() => {});
    if (tenant.email) {
      sendPlanChangeEmail({ email: tenant.email, businessName: tenant.businessName, planName, priceText, isUpgrade }).catch(() => {});
    }

    return Response.json({ ok: true, plan });
  } catch (err) {
    console.error("[billing/upgrade] error:", err?.message || err);
    return Response.json({ error: err?.message || "Failed to change plan" }, { status: 500 });
  }
}
