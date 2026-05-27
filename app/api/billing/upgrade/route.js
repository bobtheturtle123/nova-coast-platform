import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";

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

    // Update the subscription — Stripe prorates mid-month automatically
    await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
      items: [{ id: mainItem.id, price: newPriceId }],
      proration_behavior: "create_prorations",
      metadata: { plan, tenantId: ctx.tenantId },
    });

    // Mirror to Firestore immediately (webhook will also update, but this gives instant UI feedback)
    await adminDb.collection("tenants").doc(ctx.tenantId).update({
      subscriptionPlan: plan,
    });

    return Response.json({ ok: true, plan });
  } catch (err) {
    console.error("[billing/upgrade] error:", err?.message || err);
    return Response.json({ error: err?.message || "Failed to change plan" }, { status: 500 });
  }
}
