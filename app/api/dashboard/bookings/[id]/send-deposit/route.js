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

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  // If the studio has a service agreement enabled and this booking hasn't accepted
  // it yet, the client must accept it before paying. Rather than hand them the raw
  // Stripe checkout (which has no contract), we route the link through an in-app
  // pay page (/{slug}/pay/{id}) that shows a subtle "I agree" checkbox and only
  // then forwards to Stripe. Once accepted (contractSigned), we go straight to Stripe.
  const needsAgreement = !!tenant.bookingConfig?.serviceAgreement?.enabled && !booking.contractSigned;
  let agreementToken = booking.agreementToken || null;
  const buildClientUrl = (stripeUrl) => {
    if (!needsAgreement) return stripeUrl;
    return `${getAppUrl()}/${tenant.slug || ""}/pay/${params.id}?t=${agreementToken}`;
  };

  // Return the existing checkout URL if one was recently generated (within 4 hours)
  // rather than creating a new Stripe session every time the button is clicked.
  const lastSent = safeDate(booking.emailCooldowns?.deposit);
  if (lastSent && Date.now() - lastSent.getTime() < 4 * 60 * 60 * 1000 && booking.depositCheckoutUrl) {
    // When an agreement is required, an existing token must already be present for
    // the gated link to work; if it somehow isn't, fall through to regenerate.
    if (!needsAgreement || agreementToken) {
      return Response.json({ url: buildClientUrl(booking.depositCheckoutUrl), cached: true });
    }
  }

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

  // Fail closed: a payable deposit link requires a verified Connect account.
  let connectedAccountId;
  try {
    const { requireTenantPaymentAccount } = await import("@/lib/connect");
    connectedAccountId = await requireTenantPaymentAccount(tenant);
  } catch (e) {
    console.error(`[send-deposit] payment blocked — tenant=${ctx.tenantId} reason=${e?.reason || e?.message}`);
    const { tenantPaymentBlockedResponse } = await import("@/lib/connect");
    return tenantPaymentBlockedResponse();
  }

  let session;
  try {
    const { getEffectivePlan } = await import("@/lib/plans");
    const { buildConnectedSessionPaymentData } = await import("@/lib/stripe");
    const { paymentIntentData } = await buildConnectedSessionPaymentData({
      amountCents: Math.round(depositAmount * 100),
      connectedAccountId,
      planId: getEffectivePlan(tenant),
      metadata: sessionParams.payment_intent_data.metadata,
    });
    session = await stripe.checkout.sessions.create(
      { ...sessionParams, payment_intent_data: paymentIntentData },
      { idempotencyKey: `dep_${params.id}_${Math.round(depositAmount * 100)}` }
    );
  } catch (e) {
    console.error("[send-deposit] Stripe checkout failed:", e?.message);
    return Response.json({ error: "Failed to create payment link." }, { status: 500 });
  }

  // Mint a stable agreement token if the client will be routed through the
  // in-app pay page to accept the service agreement before Stripe.
  if (needsAgreement && !agreementToken) {
    agreementToken = (await import("uuid")).v4().replace(/-/g, "");
  }

  // Store the checkout session ID and cooldown timestamp
  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({
      depositCheckoutSessionId: session.id,
      depositCheckoutUrl: session.url,
      ...(needsAgreement && agreementToken ? { agreementToken } : {}),
      "emailCooldowns.deposit": new Date(),
    });

  // The client-facing link: the agreement-gated pay page when an agreement is
  // required, otherwise the raw Stripe checkout.
  const clientUrl = buildClientUrl(session.url);

  // Send deposit request email to client (non-fatal — URL is still returned even if email fails)
  let emailSent = false;
  if (booking.clientEmail) {
    try {
      await sendDepositRequestEmail({ booking, depositUrl: clientUrl, tenant });
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
    link:      clientUrl,
    message:   `Deposit request for ${booking.fullAddress || booking.address || "property"}.\nPay deposit: ${clientUrl}`,
  });

  return Response.json({ url: clientUrl, sessionId: session.id, emailSent });
}
