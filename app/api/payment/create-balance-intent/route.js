import { adminDb } from "@/lib/firebase-admin";
import { stripe, createConnectedPaymentIntent } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";
import { getEffectivePlan } from "@/lib/plans";

export async function POST(req) {
  const rl = await rateLimit(req, "balance-intent", 10, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { bookingId, tenantId } = await req.json();

    if (!bookingId || !tenantId) {
      return Response.json({ error: "bookingId and tenantId required" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]{5,100}$/.test(bookingId) || !/^[a-zA-Z0-9_-]{5,100}$/.test(tenantId)) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const snap = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings").doc(bookingId)
      .get();

    if (!snap.exists) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = snap.data();

    if (booking.balancePaid) {
      return Response.json({ error: "Balance already paid" }, { status: 400 });
    }

    const balanceCents = Math.round((booking.remainingBalance || 0) * 100);
    if (balanceCents < 50) {
      return Response.json({ error: "Balance too low to charge" }, { status: 400 });
    }

    // Fail closed: tenant client payments require a verified Connect account —
    // no platform-account fallback.
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const tenant    = tenantDoc.exists ? tenantDoc.data() : null;

    let connectedAccountId;
    try {
      const { requireTenantPaymentAccount } = await import("@/lib/connect");
      connectedAccountId = await requireTenantPaymentAccount(tenant);
    } catch (e) {
      console.error(`[legacy-balance-intent] payment blocked — tenant=${tenantId} reason=${e?.reason || e?.message}`);
      const { customerPaymentBlockedResponse } = await import("@/lib/connect");
      return customerPaymentBlockedResponse();
    }

    const paymentIntent = await createConnectedPaymentIntent({
      amountCents: balanceCents,
      connectedAccountId,
      metadata: { bookingId, tenantId, type: "balance" },
      description: `Balance payment - ${booking.fullAddress}`,
      receiptEmail: booking.clientEmail,
      planId: getEffectivePlan(tenant),
      idempotencyKey: `bal_${bookingId}_${balanceCents}`,
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
