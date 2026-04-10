import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const { bookingId, paymentIntentId } = await req.json();
    if (!bookingId || !paymentIntentId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Retrieve from Stripe — server-authoritative, can't be spoofed
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify PI belongs to this booking
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
