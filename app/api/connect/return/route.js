import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";

// Stripe redirects the BROWSER here after Connect onboarding — there is no
// Authorization header on a top-level redirect, so we identify the tenant by the
// Stripe account id (a secret, tenant-scoped value) rather than a session token.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account");
  const to        = searchParams.get("to") || "billing";
  const appUrl    = getAppUrl();

  let connected = false;
  if (accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      // details_submitted = finished KYC; charges_enabled = can actually accept money
      const done = account.details_submitted && account.charges_enabled;

      // Find the tenant that owns this Connect account.
      const snap = await adminDb.collection("tenants")
        .where("stripeConnectAccountId", "==", accountId).limit(1).get();
      if (!snap.empty) {
        const ref = snap.docs[0].ref;
        const update = { stripeConnectOnboarded: !!done };
        if (done) update["onboarding.completed.stripe"] = true;
        await ref.update(update);
        connected = !!done;
      }
    } catch (err) {
      console.error("Connect return error:", err);
    }
  }

  const status = connected ? "complete" : "incomplete";
  const dest = to === "onboarding"
    ? `${appUrl}/onboarding/stripe?connect=${status}`
    : `${appUrl}/dashboard/billing?connect=${status}`;
  return Response.redirect(dest);
}
