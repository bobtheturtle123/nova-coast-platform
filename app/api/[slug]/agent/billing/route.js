import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { stripe, AGENT_PRO_PRICE_ID } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";

export async function POST(req, { params }) {
  const { token } = await req.json().catch(() => ({}));
  if (!token) return Response.json({ error: "token required." }, { status: 400 });

  if (!AGENT_PRO_PRICE_ID) {
    return Response.json({ error: "Agent Pro is not available yet. Contact your photographer." }, { status: 400 });
  }

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found." }, { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const agentRef  = snap.docs[0].ref;
  const agentData = snap.docs[0].data();
  const agentId   = snap.docs[0].id;

  if (agentData.isAgentPro) {
    return Response.json({ error: "Already subscribed to Agent Pro." }, { status: 409 });
  }

  // Create or retrieve Stripe customer for this agent
  let customerId = agentData.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agentData.email,
      name:  agentData.name || agentData.email,
      metadata: { agentId, tenantId: tenant.id, slug: params.slug, type: "agent" },
    });
    customerId = customer.id;
    await agentRef.update({ stripeCustomerId: customerId });
  }

  const appUrl  = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode:       "subscription",
    customer:   customerId,
    line_items: [{ price: AGENT_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${appUrl}/${params.slug}/agent/settings?token=${token}&agentpro=success`,
    cancel_url:  `${appUrl}/${params.slug}/agent/settings?token=${token}`,
    subscription_data: {
      metadata: { agentId, tenantId: tenant.id, slug: params.slug, type: "agentPro" },
    },
  });

  return Response.json({ url: session.url });
}
