import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";

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

    const { plan } = await req.json();
    const priceId  = PLAN_PRICE_IDS[plan];
    if (!priceId) return Response.json({ error: "Invalid plan" }, { status: 400 });

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data();

    // Create or retrieve Stripe customer
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

    // Create Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode:       "subscription",
      customer:   customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?subscribed=true`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      subscription_data: {
        metadata: { tenantId: ctx.tenantId, plan },
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Subscribe error:", err);
    return Response.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
