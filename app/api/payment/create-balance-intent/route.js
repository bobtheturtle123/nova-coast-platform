import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

export async function POST(req) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return Response.json({ error: "bookingId required" }, { status: 400 });
    }

    const snap = await adminDb.collection("bookings").doc(bookingId).get();

    if (!snap.exists) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = snap.data();

    if (booking.balancePaid) {
      return Response.json({ error: "Balance already paid" }, { status: 400 });
    }

    const balanceCents = Math.round(booking.remainingBalance * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   balanceCents,
      currency: "usd",
      metadata: {
        bookingId,
        type: "balance",
      },
      description:   `Nova Coast Media balance — ${booking.fullAddress}`,
      receipt_email: booking.clientEmail,
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
