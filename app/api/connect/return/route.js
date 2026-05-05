import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account");

  // Require a valid Firebase session — prevents unauthenticated CSRF-style calls
  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  let tenantId = null;
  if (authHeader) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader);
      tenantId = decoded.tenantId || null;
    } catch { /* invalid token — continue without tenantId */ }
  }

  if (accountId && tenantId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (account.details_submitted) {
        // Verify this account belongs to the authenticated tenant before updating
        const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
        if (tenantDoc.exists && tenantDoc.data().stripeConnectAccountId === accountId) {
          await tenantDoc.ref.update({ stripeConnectOnboarded: true });
        }
      }
    } catch (err) {
      console.error("Connect return error:", err);
    }
  }

  return Response.redirect(`${getAppUrl()}/dashboard/billing?connect=complete`);
}
