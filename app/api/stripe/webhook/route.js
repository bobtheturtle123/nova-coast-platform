import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { sendBookingConfirmation, sendGalleryDelivery } from "@/lib/email";

// Required: tell Next.js NOT to parse the body (Stripe needs raw bytes)
export const config = {
  api: { bodyParser: false },
};

export async function POST(req) {
  const sig       = req.headers.get("stripe-signature");
  const rawBody   = await req.text();
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ── Handle events ────────────────────────────────────────────────────────
  try {
    switch (event.type) {

      // ── Deposit paid ────────────────────────────────────────────────────
      case "payment_intent.succeeded": {
        const intent     = event.data.object;
        const { bookingId, type } = intent.metadata;
        if (!bookingId) break;

        const ref = adminDb.collection("bookings").doc(bookingId);

        if (type === "deposit") {
          await ref.update({
            depositPaid:           true,
            status:                "requested",
            stripeDepositIntentId: intent.id,
          });

          // Fetch booking to send confirmation email
          const snap    = await ref.get();
          const booking = snap.data();

          await sendBookingConfirmation({ booking });
        }

        if (type === "balance") {
          await ref.update({
            balancePaid:      true,
            status:           "completed",
            galleryUnlocked:  true,
          });

          // Unlock gallery
          const snap    = await ref.get();
          const booking = snap.data();

          if (booking.galleryId) {
            await adminDb.collection("galleries").doc(booking.galleryId).update({
              unlocked: true,
            });
          }
        }
        break;
      }

      // ── Payment failed ──────────────────────────────────────────────────
      case "payment_intent.payment_failed": {
        const intent    = event.data.object;
        const { bookingId } = intent.metadata;
        if (!bookingId) break;

        await adminDb.collection("bookings").doc(bookingId).update({
          status: "payment_failed",
        });
        break;
      }

      default:
        // Unhandled event — safe to ignore
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Return 200 so Stripe doesn't retry — we'll investigate manually
  }

  return new Response("OK", { status: 200 });
}
