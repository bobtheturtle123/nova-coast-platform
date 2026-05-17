import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   balanceCents,
      currency: "usd",
      metadata: {
        bookingId,
        tenantId,
        type: "balance",
      },
      description:   `Balance payment - ${booking.fullAddress}`,
      receipt_email: booking.clientEmail,
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
