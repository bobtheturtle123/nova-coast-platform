import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendPaymentReminder } from "@/lib/email";
import { safeDate } from "@/lib/dateUtils";
import { stripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/appUrl";
import { logBookingActivity } from "@/lib/activityLog";

const EMAIL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between reminder sends

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/bookings/[id]/send-reminder
// Sends a payment reminder email to the client with a gallery link to pay the balance.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();

  if (!booking.depositPaid && !booking.galleryId) {
    // If no deposit and no gallery, nothing to remind about yet
  }

  if (booking.paidInFull || booking.balancePaid) {
    return Response.json({ error: "No outstanding balance on this booking." }, { status: 400 });
  }

  // Cooldown: prevent spamming reminder emails
  const lastSent = safeDate(booking.emailCooldowns?.reminder);
  if (lastSent && Date.now() - lastSent.getTime() < EMAIL_COOLDOWN_MS) {
    return Response.json({ error: "Reminder was recently sent. Please wait before resending." }, { status: 429 });
  }

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  // Fetch gallery token (fallback CTA if Stripe checkout unavailable)
  let galleryToken = null;
  if (booking.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("galleries").doc(booking.galleryId)
      .get();
    if (galleryDoc.exists) {
      galleryToken = galleryDoc.data().accessToken || galleryDoc.data().token || null;
    }
  }

  // Create a Stripe checkout session so the client can pay directly from the email
  const appUrl    = getAppUrl();
  const address   = booking.fullAddress || booking.address || "Property";
  const amountDue = booking.depositPaid
    ? (booking.remainingBalance || 0)
    : (booking.depositAmount || booking.totalPrice || 0);
  const paymentType = booking.depositPaid ? "balance" : "deposit";

  let paymentUrl = null;
  if (amountDue > 0) {
    try {
      const sessionParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `${booking.depositPaid ? "Balance due" : "Deposit"} — ${address}`,
              description: `${tenant.businessName || "Photography"} payment reminder`,
            },
            unit_amount: Math.round(amountDue * 100),
          },
          quantity: 1,
        }],
        customer_email: booking.clientEmail || undefined,
        success_url: `${appUrl}/payment-success?bookingId=${params.id}&type=${paymentType}`,
        cancel_url:  `${appUrl}/${tenant.slug || ""}/book/payment?cancelled=true`,
        metadata: {
          bookingId:  params.id,
          tenantId:   ctx.tenantId,
          type:       paymentType,
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
    } catch (e) {
      console.error("[send-reminder] Stripe checkout failed (non-fatal):", e?.message);
    }
  }

  await sendPaymentReminder({ booking, galleryToken, paymentUrl, tenant });

  const galleryLink = galleryToken ? `${appUrl}/${tenant.slug || ""}/gallery/${galleryToken}` : null;
  await logBookingActivity(ctx.tenantId, params.id, {
    type:      "reminder_sent",
    title:     `Payment reminder emailed — $${amountDue.toLocaleString()} due`,
    channel:   "email",
    recipient: booking.clientEmail || null,
    link:      paymentUrl || galleryLink,
    message:   `Payment reminder for ${address}.\n${booking.depositPaid ? "Balance due" : "Deposit"}: $${amountDue.toLocaleString()}.${paymentUrl ? `\nPay: ${paymentUrl}` : galleryLink ? `\nGallery: ${galleryLink}` : ""}`,
  });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ "emailCooldowns.reminder": new Date() });

  return Response.json({ ok: true, paymentUrl });
}
