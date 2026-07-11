import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";
import { safeDate } from "@/lib/dateUtils";
import { sendDepositRequestEmail } from "@/lib/email";

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

  // Return the existing checkout URL if one was recently generated (within 4 hours)
  // rather than creating a new Stripe session every time the button is clicked.
  const lastSent = safeDate(booking.emailCooldowns?.deposit);
  if (lastSent && Date.now() - lastSent.getTime() < 4 * 60 * 60 * 1000 && booking.depositCheckoutUrl) {
    return Response.json({ url: booking.depositCheckoutUrl, cached: true });
  }

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  // Use the booking's stored deposit amount. A stored 0 means "no deposit" — do
  // NOT fabricate a 50% deposit (?? not ||), so no-deposit bookings stay at $0.
  const depositAmount = booking.depositAmount ?? Math.round((booking.totalPrice || 0) * 0.5);
  if (!depositAmount || depositAmount <= 0) {
    return Response.json({ error: "This booking has no deposit configured (pay-in-full). Use the full payment link instead." }, { status: 400 });
  }
  if (Math.round(depositAmount * 100) < 50) {
    return Response.json({ error: `Deposit of $${depositAmount} is below the $0.50 minimum for online payment.` }, { status: 400 });
  }

  const appUrl = getAppUrl();
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
    success_url: `${appUrl}/payment-success?bookingId=${params.id}&type=deposit&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/${tenant.slug || ""}/book/payment?cancelled=true`,
    metadata: {
      bookingId:  params.id,
      tenantId:   ctx.tenantId,
      type:       "deposit",
      clientName: booking.clientName || "",
    },
    payment_intent_data: {
      metadata: {
        bookingId: params.id,
        tenantId:  ctx.tenantId,
        type:      "deposit",
      },
    },
  };

  let session;
  try {
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      const { calculatePlatformFee, getEffectivePlan } = await import("@/lib/plans");
      const platformFee = calculatePlatformFee(Math.round(depositAmount * 100), getEffectivePlan(tenant));
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        payment_intent_data: {
          ...sessionParams.payment_intent_data,
          application_fee_amount: platformFee,
          transfer_data: { destination: tenant.stripeConnectAccountId },
        },
      });
    } else {
      session = await stripe.checkout.sessions.create(sessionParams);
    }
  } catch (e) {
    console.error("[send-deposit] Stripe checkout failed:", e?.message);
    return Response.json({ error: e?.message || "Failed to create payment link." }, { status: 500 });
  }

  // Store the checkout session ID and cooldown timestamp
  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({
      depositCheckoutSessionId: session.id,
      depositCheckoutUrl: session.url,
      "emailCooldowns.deposit": new Date(),
    });

  // Send deposit request email to client (non-fatal — URL is still returned even if email fails)
  let emailSent = false;
  if (booking.clientEmail) {
    try {
      await sendDepositRequestEmail({ booking, depositUrl: session.url, tenant });
      emailSent = true;
    } catch (e) {
      console.error("[send-deposit] email failed (non-fatal):", e?.message);
    }
  }

  const { logBookingActivity } = await import("@/lib/activityLog");
  await logBookingActivity(ctx.tenantId, params.id, {
    type:      "deposit_link",
    title:     emailSent ? "Deposit request emailed" : "Deposit link generated",
    channel:   emailSent ? "email" : null,
    recipient: emailSent ? (booking.clientEmail || null) : null,
    link:      session.url,
    message:   `Deposit request for ${booking.fullAddress || booking.address || "property"}.\nPay deposit: ${session.url}`,
  });

  return Response.json({ url: session.url, sessionId: session.id, emailSent });
}
