import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { assessConnectAccount } from "@/lib/connect";

export const dynamic = "force-dynamic";

// Live Stripe payment-setup status for the signed-in tenant. Drives the
// billing-page setup card — the UI must never show "connected" based only on
// the presence of an acct_ id, so this retrieves the real account state.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(decoded.tenantId);
  const tenantDoc = await tenantRef.get();
  const tenant = tenantDoc.data() || {};

  if (!tenant.stripeConnectAccountId) {
    return Response.json({ status: "not_connected", ok: false, paymentsEnabled: false });
  }

  let account = null;
  try {
    account = await stripe.accounts.retrieve(tenant.stripeConnectAccountId);
  } catch (e) {
    return Response.json({
      status: "temporarily_unavailable", ok: false, paymentsEnabled: false,
      detail: "Stripe could not be reached. Try again shortly.",
    });
  }

  const assessment = assessConnectAccount(account);

  // Self-heal the stored flags so booking pages and validation agree.
  tenantRef.update({
    stripeConnectChargesEnabled: account.charges_enabled === true,
    stripeConnectPayoutsEnabled: account.payouts_enabled === true,
    stripeConnectStatus:         assessment.status,
    stripeConnectStatusReason:   assessment.reason || null,
    stripeConnectOnboarded:      assessment.ok,
    stripeConnectUpdatedAt:      new Date(),
  }).catch(() => {});

  return Response.json({
    status:          assessment.status,   // connected | charges_disabled | payouts_disabled | restricted | information_required | capability_inactive | account_disconnected
    ok:              assessment.ok,
    paymentsEnabled: assessment.ok,
    detail:          assessment.ok ? null : (assessment.reason || null),
  });
}
