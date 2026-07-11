import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { logPaymentActivity } from "@/lib/activityLog";

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

    // Keyed on the PaymentIntent id — merges with the webhook's entry instead
    // of duplicating when both this fallback and the webhook process the payment.
    const logPi = (paymentType) => logPaymentActivity(tenantId, bookingId, {
      paymentType,
      payerName:  booking.clientName  || null,
      payerEmail: booking.clientEmail || pi.receipt_email || null,
      grossCents: pi.amount_received ?? pi.amount ?? 0,
      tipCents:   paymentType !== "balance" ? Math.round((Number(booking.tipAmount) || 0) * 100) : 0,
      feeCents:   pi.application_fee_amount ?? null,
      currency:   pi.currency || "usd",
      piId:       pi.id,
      chargeId:   typeof pi.latest_charge === "string" ? pi.latest_charge : null,
      connectedAccountId: pi.transfer_data?.destination || null,
      source:     "payment verification",
      address:    booking.fullAddress || booking.address || null,
      method:     "card",
    });

    if (type === "deposit") {
      let shouldNotify = false;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().depositPaid) return;
        tx.update(bookingRef, { depositPaid: true, status: "requested", stripeDepositIntentId: pi.id });
        shouldNotify = true;
      });
      logPi("deposit");
      if (shouldNotify) {
        console.log(`[verify-payment] deposit confirmed bookingId=${bookingId}`);
        _sendNotifications(tenantId, bookingId, { ...booking, depositPaid: true });
      } else {
        console.log(`[verify-payment] deposit already recorded bookingId=${bookingId}`);
      }
      return Response.json({ ok: true, paidInFull: false });
    }

    if (type === "full") {
      let shouldNotify = false;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().paidInFull) return;
        tx.update(bookingRef, {
          depositPaid: true, balancePaid: true, paidInFull: true,
          remainingBalance: 0, status: "requested", stripeDepositIntentId: pi.id,
        });
        shouldNotify = true;
      });
      logPi("full");
      if (shouldNotify) {
        console.log(`[verify-payment] full payment confirmed bookingId=${bookingId}`);
        _sendNotifications(tenantId, bookingId, { ...booking, depositPaid: true, paidInFull: true });
      } else {
        console.log(`[verify-payment] full payment already recorded bookingId=${bookingId}`);
      }
      return Response.json({ ok: true, paidInFull: true });
    }

    if (type === "balance") {
      let shouldNotify = false;
      let galleryId = null;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().balancePaid) return;
        galleryId = snap.data().galleryId || null;
        tx.update(bookingRef, {
          balancePaid: true, paidInFull: true, remainingBalance: 0,
          stripeBalanceIntentId: pi.id,
        });
        shouldNotify = true;
      });
      const paidAmount = (pi.amount_received ?? pi.amount ?? 0) / 100;
      if (galleryId) {
        await adminDb
          .collection("tenants").doc(tenantId)
          .collection("galleries").doc(galleryId)
          .update({ unlocked: true, unlockedAt: new Date() }).catch(() => {});
        // Record the payment in the gallery's activity log, with who paid.
        if (shouldNotify) {
          adminDb
            .collection("tenants").doc(tenantId)
            .collection("galleries").doc(galleryId)
            .collection("activityLog")
            .add({
              event: "payment",
              amount: paidAmount,
              viewerEmail: booking.clientEmail || pi.receipt_email || null,
              viewerName:  booking.clientName || null,
              timestamp: new Date(),
            }).catch(() => {});
        }
      }
      logPi("balance");
      if (shouldNotify) {
        console.log(`[verify-payment] balance confirmed bookingId=${bookingId}`);
        // Notify the tenant that the balance was paid.
        _notifyBalancePaid(tenantId, bookingId, booking, paidAmount);
      } else {
        console.log(`[verify-payment] balance already recorded bookingId=${bookingId}`);
      }
      return Response.json({ ok: true, paidInFull: true });
    }

    console.log(`[verify-payment] no update needed bookingId=${bookingId} type=${type}`);
    return Response.json({ ok: true, paidInFull: booking.paidInFull || false });
  } catch (err) {
    console.error("Verify payment error:", err);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}

// Fire notifications best-effort. The Stripe webhook may have already sent them;
// idempotency is handled by checking depositPaid before calling this.
async function _sendNotifications(tenantId, bookingId, booking) {
  try {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return;
    console.log(`[verify-payment] sending notifications for bookingId=${bookingId}`);
    await sendBookingCreatedNotifications({
      booking,
      tenant,
      adminEmail: tenant.email || null,
    });
    sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" })
      .catch((e) => console.error("[verify-payment] agent portal email FAILED:", e?.message || e));
    sendBookingConfirmedSms({ booking, tenant })
      .then(() => console.log(`[verify-payment] SMS fired for bookingId=${bookingId}`))
      .catch((e) => console.error("[verify-payment] SMS FAILED:", e?.message || e));
  } catch (e) {
    console.error("[verify-payment] _sendNotifications error (non-fatal):", e?.message || e);
  }
}

// Notify the tenant that a client/agent paid their balance. (The activity-log
// entry is written by logPi("balance") with an idempotent key — no keyless
// duplicate here.)
async function _notifyBalancePaid(tenantId, bookingId, booking, amount) {
  const address = booking.fullAddress || booking.address || "a listing";
  const who     = booking.clientName || booking.clientEmail || "The client";
  try {
    const tenant = await getTenantById(tenantId);
    const ownerEmail = tenant?.email;
    const key = process.env.RESEND_API_KEY;
    if (ownerEmail && key) {
      const { Resend } = await import("resend");
      await new Resend(key).emails.send({
        from: `KyoriaOS <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
        to: ownerEmail,
        subject: `Payment received — $${Number(amount).toLocaleString()} for ${address}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px 24px"><h2 style="color:#16a34a;margin:0 0 12px">Balance paid ✓</h2><p style="color:#555"><strong>${who}</strong> just paid the remaining balance of <strong>$${Number(amount).toLocaleString()}</strong> for <strong>${address}</strong>. The gallery is now unlocked.</p></div>`,
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[verify-payment] _notifyBalancePaid error (non-fatal):", e?.message || e);
  }
}
