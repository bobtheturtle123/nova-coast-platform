import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";

// POST /api/payment/verify-session
// Called from the /payment-success page as a belt-and-suspenders fallback
// in case the Stripe webhook hasn't fired yet.
export async function POST(req) {
  const rl = await rateLimit(req, "verify-session", 30, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { sessionId, bookingId } = await req.json();

    if (!sessionId || !bookingId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!/^cs_(live|test)_[a-zA-Z0-9_#%]{10,}/.test(sessionId)) {
      return Response.json({ error: "Invalid session ID" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{5,100}$/.test(bookingId)) {
      return Response.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Security: verify the session metadata matches the claimed bookingId
    if (session.metadata?.bookingId !== bookingId) {
      return Response.json({ error: "Session mismatch" }, { status: 400 });
    }
    if (session.payment_status !== "paid") {
      return Response.json({ error: "Payment not completed", status: session.payment_status }, { status: 400 });
    }

    const { tenantId, type } = session.metadata;
    if (!tenantId) return Response.json({ error: "Missing tenantId in session metadata" }, { status: 400 });

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
        const data = snap.data();
        const newRemainingBalance = Math.max(0, (data.totalPrice || 0) - (data.depositAmount || 0));
        tx.update(bookingRef, {
          depositPaid: true,
          remainingBalance: newRemainingBalance,
          status: "requested",
          stripeDepositSessionId: session.id,
        });
        shouldNotify = true;
      });
      if (shouldNotify) {
        console.log(`[verify-session] deposit confirmed bookingId=${bookingId}`);
        _sendNotifications(tenantId, bookingId, { ...booking, depositPaid: true });
      } else {
        console.log(`[verify-session] deposit already recorded bookingId=${bookingId}`);
      }
      return Response.json({ ok: true, type: "deposit" });
    }

    if (type === "balance") {
      let shouldNotify = false;
      let galleryId = null;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().balancePaid) return;
        galleryId = snap.data().galleryId || null;
        tx.update(bookingRef, {
          balancePaid: true,
          paidInFull: true,
          remainingBalance: 0,
          stripeBalanceSessionId: session.id,
        });
        shouldNotify = true;
      });
      if (galleryId) {
        await adminDb
          .collection("tenants").doc(tenantId)
          .collection("galleries").doc(galleryId)
          .update({ unlocked: true, unlockedAt: new Date() });
      }
      if (shouldNotify) {
        console.log(`[verify-session] balance confirmed bookingId=${bookingId}`);
      } else {
        console.log(`[verify-session] balance already recorded bookingId=${bookingId}`);
      }
      return Response.json({ ok: true, type: "balance" });
    }

    if (type === "full") {
      // Invoice "pay full" checkout — mark everything paid (mirrors the
      // webhook's payment_intent.succeeded "full" handler). Previously this
      // type fell through unhandled, so the success-page fallback did nothing.
      let shouldNotify = false;
      let galleryId = null;
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists || snap.data().paidInFull) return;
        galleryId = snap.data().galleryId || null;
        tx.update(bookingRef, {
          depositPaid: true, balancePaid: true, paidInFull: true,
          remainingBalance: 0, status: "requested",
          stripeFullSessionId: session.id,
        });
        shouldNotify = true;
      });
      if (galleryId) {
        await adminDb
          .collection("tenants").doc(tenantId)
          .collection("galleries").doc(galleryId)
          .update({ unlocked: true, unlockedAt: new Date() })
          .catch(() => {});
      }
      if (shouldNotify) {
        console.log(`[verify-session] full payment confirmed bookingId=${bookingId}`);
        _sendNotifications(tenantId, bookingId, { ...booking, depositPaid: true, paidInFull: true });
      }
      return Response.json({ ok: true, type: "full" });
    }

    return Response.json({ ok: true, type });
  } catch (err) {
    console.error("[verify-session] error:", err);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}

async function _sendNotifications(tenantId, bookingId, booking) {
  try {
    const tenant = await getTenantById(tenantId);
    if (!tenant) return;
    await sendBookingCreatedNotifications({ booking, tenant, adminEmail: tenant.email || null });
    sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" })
      .catch((e) => console.error("[verify-session] agent portal FAILED:", e?.message || e));
    sendBookingConfirmedSms({ booking, tenant })
      .catch((e) => console.error("[verify-session] SMS FAILED:", e?.message || e));
  } catch (e) {
    console.error("[verify-session] _sendNotifications error (non-fatal):", e?.message || e);
  }
}
