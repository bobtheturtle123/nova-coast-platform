import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  if (decoded.role) return null; // staff members cannot access billing portal
  return { tenantId: decoded.tenantId };
}

export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data();

    if (!tenant?.stripeCustomerId) {
      return Response.json({ error: "No billing account found" }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   tenant.stripeCustomerId,
      return_url: `${getAppUrl()}/dashboard/billing`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    return Response.json({ error: "Failed to open portal" }, { status: 500 });
  }
}
