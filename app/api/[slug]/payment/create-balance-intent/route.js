import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { createConnectedPaymentIntent, stripe } from "@/lib/stripe";

export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    const { bookingId } = await req.json();

    const bookingRef = adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(bookingId);

    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

    const booking = bookingDoc.data();
    if (booking.balancePaid) return Response.json({ error: "Balance already paid" }, { status: 400 });

    const amountCents = Math.round(booking.remainingBalance * 100);

    let paymentIntent;
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      paymentIntent = await createConnectedPaymentIntent({
        amountCents,
        connectedAccountId: tenant.stripeConnectAccountId,
        metadata: { bookingId, type: "balance", tenantId: tenant.id },
        description: `${tenant.businessName} balance — ${booking.fullAddress}`,
        receiptEmail: booking.clientEmail,
      });
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount:   amountCents,
        currency: "usd",
        metadata: { bookingId, type: "balance", tenantId: tenant.id },
        description: `${tenant.businessName} balance — ${booking.fullAddress}`,
        receipt_email: booking.clientEmail,
      });
    }

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
