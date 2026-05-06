import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe, AGENT_PRO_PRICE_ID } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — photographer subscribes to Agent Pro platform-wide (enables for all agents)
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!AGENT_PRO_PRICE_ID) {
    return Response.json({
      error: "Stripe is not yet configured. Add STRIPE_PRICE_AGENT_PRO to environment variables.",
    }, { status: 400 });
  }

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenant    = tenantDoc.data();

  if (tenant?.agentProActive) {
    return Response.json({ error: "Agent Pro is already active." }, { status: 409 });
  }

  let customerId = tenant?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant?.email,
      name:  tenant?.businessName,
      metadata: { tenantId: ctx.tenantId },
    });
    customerId = customer.id;
    await adminDb.collection("tenants").doc(ctx.tenantId).update({ stripeCustomerId: customerId });
  }

  const appUrl  = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode:       "subscription",
    customer:   customerId,
    line_items: [{ price: AGENT_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?agentpro=success`,
    cancel_url:  `${appUrl}/dashboard/billing`,
    subscription_data: {
      metadata: { tenantId: ctx.tenantId, type: "agentProPlatform" },
    },
  });

  return Response.json({ url: session.url });
}
