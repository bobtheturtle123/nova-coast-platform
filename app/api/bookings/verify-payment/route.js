import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  // 20 attempts per IP per hour — prevents payment intent probing
  const rl = await rateLimit(req, "verify-payment", 20, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { bookingId, paymentIntentId } = await req.json();
    if (!bookingId || !paymentIntentId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate IDs look reasonable before hitting Stripe
    if (!/^[a-zA-Z0-9_-]{5,100}$/.test(bookingId) || !/^pi_[a-zA-Z0-9_]{10,}$/.test(paymentIntentId)) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Retrieve from Stripe — server-authoritative, metadata was set server-side
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify PI belongs to this exact booking (set when PI was created)
    if (pi.metadata?.bookingId !== bookingId) {
      return Response.json({ error: "Payment intent mismatch" }, { status: 400 });
    }
    if (pi.status !== "succeeded") {
      return Response.json({ error: "Payment not completed", piStatus: pi.status }, { status: 400 });
    }

    const { tenantId, type } = pi.metadata;
    if (!tenantId) return Response.json({ error: "Missing tenantId in payment metadata" }, { status: 400 });

    const bookingRef = adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings").doc(bookingId);

    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

    const booking = bookingDoc.data();

    if (type === "deposit" && !booking.depositPaid) {
      await bookingRef.update({
        depositPaid: true,
        status: "requested",
        stripeDepositIntentId: pi.id,
      });
      return Response.json({ ok: true, paidInFull: false });
    }

    if (type === "full" && !booking.paidInFull) {
      await bookingRef.update({
        depositPaid:  true,
        balancePaid:  true,
        paidInFull:   true,
        remainingBalance: 0,
        status: "requested",
        stripeDepositIntentId: pi.id,
      });
      return Response.json({ ok: true, paidInFull: true });
    }

    // Already updated (e.g. webhook already ran)
    return Response.json({ ok: true, paidInFull: booking.paidInFull || false });
  } catch (err) {
    console.error("Verify payment error:", err);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}
