import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { stripe } from "@/lib/stripe";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/bookings/[id]/send-deposit
// Creates a Stripe Checkout Session for the deposit and returns the URL.
// Admin can then send this URL to the client.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();

  if (booking.depositPaid) {
    return Response.json({ error: "Deposit already collected" }, { status: 400 });
  }

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const depositAmount = booking.depositAmount || Math.round((booking.totalPrice || 0) * 0.5);
  if (!depositAmount || depositAmount <= 0) {
    return Response.json({ error: "No deposit amount set on this booking" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const address = booking.fullAddress || booking.address || "Property";

  // Build Checkout Session — use tenant's Connect account if available
  const sessionParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Deposit — ${address}`,
          description: `${tenant.businessName || "Photography"} booking deposit`,
        },
        unit_amount: Math.round(depositAmount * 100),
      },
      quantity: 1,
    }],
    customer_email: booking.clientEmail || undefined,
    success_url: `${appUrl}/payment-success?bookingId=${params.id}&type=deposit`,
    cancel_url:  `${appUrl}/${tenant.slug || ""}/book/payment?cancelled=true`,
    metadata: {
      bookingId:  params.id,
      tenantId:   ctx.tenantId,
      type:       "deposit",
      clientName: booking.clientName || "",
    },
  };

  let session;
  if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
    // Route through Connect account
    const platformFee = Math.round(depositAmount * 100 * (Number(process.env.PLATFORM_FEE_BPS || 150) / 10000));
    session = await stripe.checkout.sessions.create(
      { ...sessionParams, payment_intent_data: { application_fee_amount: platformFee, transfer_data: { destination: tenant.stripeConnectAccountId } } },
    );
  } else {
    session = await stripe.checkout.sessions.create(sessionParams);
  }

  // Store the checkout session ID so webhook can mark deposit paid
  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ depositCheckoutSessionId: session.id, depositCheckoutUrl: session.url });

  return Response.json({ url: session.url, sessionId: session.id });
}
