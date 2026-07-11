import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { createConnectedPaymentIntent, stripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";
import { getEffectivePlan } from "@/lib/plans";

export async function POST(req, { params }) {
  try {
    const { limited } = await rateLimit(req, "balance-intent", 10, 3600);
    if (limited) return Response.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

    const { bookingId } = body;
    if (!bookingId || typeof bookingId !== "string" || !/^[\w-]{6,64}$/.test(bookingId)) {
      return Response.json({ error: "Invalid bookingId" }, { status: 400 });
    }

    const bookingRef = adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(bookingId);

    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

    const booking = bookingDoc.data();
    if (booking.balancePaid) return Response.json({ error: "Balance already paid" }, { status: 400 });

    const amountCents = Math.round((booking.remainingBalance || 0) * 100);
    if (amountCents < 50) {
      return Response.json({ error: "Balance too low to charge" }, { status: 400 });
    }

    // Fail closed: no platform-account fallback for tenant client payments.
    let connectedAccountId;
    try {
      const { requireTenantPaymentAccount } = await import("@/lib/connect");
      connectedAccountId = await requireTenantPaymentAccount(tenant);
    } catch (e) {
      console.error(`[balance-intent] payment blocked — tenant=${tenant.id} reason=${e?.reason || e?.message}`);
      const { customerPaymentBlockedResponse } = await import("@/lib/connect");
      return customerPaymentBlockedResponse();
    }

    const paymentIntent = await createConnectedPaymentIntent({
      amountCents,
      connectedAccountId,
      metadata: { bookingId, type: "balance", tenantId: tenant.id },
      description: `${tenant.businessName} balance — ${booking.fullAddress}`,
      receiptEmail: booking.clientEmail,
      planId: getEffectivePlan(tenant),
      idempotencyKey: `bal_${bookingId}_${amountCents}`,
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
