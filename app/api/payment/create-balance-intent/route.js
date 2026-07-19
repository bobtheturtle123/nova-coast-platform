import { adminDb } from "@/lib/firebase-admin";
import { createConnectedPaymentIntent } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";
import { getEffectivePlan } from "@/lib/plans";

// Legacy gallery balance payment. The tenant is derived ENTIRELY from the
// gallery's strong access token (galleryTokens/{token} -> tenantId, galleryId),
// never from a browser-supplied tenantId. The gallery is verified to own the
// token and the booking, so a caller cannot mix another tenant's id, point a
// payment at a gallery they don't hold the token for, or apply one gallery's
// payment to another.
export async function POST(req) {
  const rl = await rateLimit(req, "balance-intent", 10, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    // Accept the gallery access token (preferred). `bookingId` is accepted for
    // back-compat but is IGNORED for tenant/gallery resolution.
    const token = String(body.token || body.galleryToken || "").trim();
    if (!token || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
      return Response.json({ error: "A valid gallery link is required." }, { status: 400 });
    }

    // 1) token -> tenantId + galleryId (trusted server index)
    const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
    if (!tokenDoc.exists) return Response.json({ error: "Gallery not found." }, { status: 404 });
    const { tenantId, galleryId } = tokenDoc.data();
    if (!tenantId || !galleryId) return Response.json({ error: "Gallery not found." }, { status: 404 });

    // 2) load the gallery under that tenant and confirm it owns this token
    const galleryDoc = await adminDb.collection("tenants").doc(tenantId)
      .collection("galleries").doc(galleryId).get();
    if (!galleryDoc.exists) return Response.json({ error: "Gallery not found." }, { status: 404 });
    const gallery = galleryDoc.data();
    if (gallery.accessToken !== token) return Response.json({ error: "Gallery not found." }, { status: 404 });

    // 3) the booking is whatever THIS gallery references — never client input
    const bookingId = gallery.bookingId;
    if (!bookingId) return Response.json({ error: "No balance is due for this gallery." }, { status: 400 });
    const snap = await adminDb.collection("tenants").doc(tenantId)
      .collection("bookings").doc(bookingId).get();
    if (!snap.exists) return Response.json({ error: "No balance is due for this gallery." }, { status: 400 });
    const booking = snap.data();

    if (booking.balancePaid || booking.paidInFull) {
      return Response.json({ error: "Balance already paid" }, { status: 400 });
    }

    // 4) amount is computed server-side from the booking (never trusted from client)
    const balanceCents = Math.round((Number(booking.remainingBalance) || 0) * 100);
    if (balanceCents < 50) {
      return Response.json({ error: "Balance too low to charge" }, { status: 400 });
    }

    // 5) fail closed: require a verified Connect account (no platform fallback)
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const tenant    = tenantDoc.exists ? tenantDoc.data() : null;
    let connectedAccountId;
    try {
      const { requireTenantPaymentAccount } = await import("@/lib/connect");
      connectedAccountId = await requireTenantPaymentAccount(tenant);
    } catch (e) {
      console.error(`[legacy-balance-intent] payment blocked — tenant=${tenantId} reason=${e?.reason || e?.message}`);
      const { customerPaymentBlockedResponse } = await import("@/lib/connect");
      return customerPaymentBlockedResponse();
    }

    // 6) canonical per-plan fee + destination applied inside createConnectedPaymentIntent
    const paymentIntent = await createConnectedPaymentIntent({
      amountCents: balanceCents,
      connectedAccountId,
      metadata: { bookingId, tenantId, galleryId, type: "balance" },
      description: `Balance payment - ${booking.fullAddress || "gallery"}`,
      receiptEmail: booking.clientEmail,
      planId: getEffectivePlan(tenant),
      idempotencyKey: `bal_${bookingId}_${balanceCents}`,
    });

    return Response.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Balance intent error:", err);
    return Response.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
