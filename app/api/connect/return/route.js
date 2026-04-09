import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { redirect } from "next/navigation";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account");

  if (accountId) {
    // Verify onboarding completion
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (account.details_submitted) {
        // Find tenant by connect account id and mark as onboarded
        const snap = await adminDb
          .collection("tenants")
          .where("stripeConnectAccountId", "==", accountId)
          .limit(1)
          .get();

        if (!snap.empty) {
          await snap.docs[0].ref.update({ stripeConnectOnboarded: true });
        }
      }
    } catch (err) {
      console.error("Connect return error:", err);
    }
  }

  return Response.redirect(
    new URL("/dashboard/billing?connect=complete", req.url)
  );
}
