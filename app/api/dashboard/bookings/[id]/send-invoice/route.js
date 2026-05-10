import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendInvoiceEmail } from "@/lib/email";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";
import { safeDate } from "@/lib/dateUtils";

const EMAIL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between invoice sends

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/bookings/[id]/send-invoice
// Sends an invoice email to the client with an optional Stripe Checkout payment link.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();

  // Cooldown: prevent spamming invoice emails to the same client
  const lastSent = safeDate(booking.emailCooldowns?.invoice);
  if (lastSent && Date.now() - lastSent.getTime() < EMAIL_COOLDOWN_MS) {
    return Response.json({ error: "Invoice was recently sent. Please wait before resending." }, { status: 429 });
  }

  const tenant  = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const appUrl = getAppUrl();
  const address = booking.fullAddress || booking.address || "Property";

  // Determine amount due and build a Stripe Checkout link if applicable
  const paidInFull   = booking.paidInFull || booking.balancePaid;
  const depositPaid  = booking.depositPaid;
  const amountDue    = paidInFull ? 0 : depositPaid
    ? (booking.remainingBalance || 0)
    : (booking.depositAmount || booking.totalPrice || 0);
  const paymentLabel = depositPaid ? "Balance due" : "Deposit";

  let paymentUrl = null;

  if (amountDue > 0) {
    const sessionParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${paymentLabel} — ${address}`,
            description: `${tenant.businessName || "Photography"} invoice`,
          },
          unit_amount: Math.round(amountDue * 100),
        },
        quantity: 1,
      }],
      customer_email: booking.clientEmail || undefined,
      success_url: `${appUrl}/payment-success?bookingId=${params.id}&type=${depositPaid ? "balance" : "deposit"}`,
      cancel_url:  `${appUrl}/${tenant.slug || ""}/book/payment?cancelled=true`,
      metadata: {
        bookingId:  params.id,
        tenantId:   ctx.tenantId,
        type:       depositPaid ? "balance" : "deposit",
        clientName: booking.clientName || "",
      },
    };

    let session;
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      const platformFee = Math.round(amountDue * 100 * (Number(process.env.PLATFORM_FEE_BPS || 150) / 10000));
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: { destination: tenant.stripeConnectAccountId },
        },
      });
    } else {
      session = await stripe.checkout.sessions.create(sessionParams);
    }

    paymentUrl = session.url;
  }

  await sendInvoiceEmail({ booking, paymentUrl, tenant });

  // Stamp cooldown timestamp so rapid re-sends are blocked
  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ "emailCooldowns.invoice": new Date() });

  return Response.json({ ok: true });
}
