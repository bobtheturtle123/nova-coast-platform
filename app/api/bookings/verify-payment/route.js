import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";

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

    if (type === "deposit") {
      let shouldNotify = false;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().depositPaid) return;
        tx.update(bookingRef, { depositPaid: true, status: "requested", stripeDepositIntentId: pi.id });
        shouldNotify = true;
      });
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
      if (shouldNotify) {
        console.log(`[verify-payment] full payment confirmed bookingId=${bookingId}`);
        _sendNotifications(tenantId, bookingId, { ...booking, depositPaid: true, paidInFull: true });
      } else {
        console.log(`[verify-payment] full payment already recorded bookingId=${bookingId}`);
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
