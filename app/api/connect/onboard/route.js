import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { createConnectAccount, createConnectOnboardingLink } from "@/lib/stripe";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { tenantId: decoded.tenantId };
}

export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
    const tenantDoc = await tenantRef.get();
    const tenant    = tenantDoc.data();

    let accountId = tenant.stripeConnectAccountId;

    // Create Connect account if it doesn't exist
    if (!accountId) {
      const account = await createConnectAccount({
        email:        tenant.email,
        businessName: tenant.businessName,
      });
      accountId = account.id;
      await tenantRef.update({ stripeConnectAccountId: accountId });
    }

    // Generate onboarding link
    const url = await createConnectOnboardingLink(accountId);
    return Response.json({ url });
  } catch (err) {
    console.error("Connect onboard error:", err);
    return Response.json({ error: err.message || "Failed to start Stripe Connect" }, { status: 500 });
  }
}
