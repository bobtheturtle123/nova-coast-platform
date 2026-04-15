import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const sig     = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {

      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const { bookingId, type, tenantId } = pi.metadata;
        if (!bookingId || !tenantId) break;

        const bookingRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);

        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) break;
        const booking = bookingDoc.data();

        if (type === "deposit" && !booking.depositPaid) {
          await bookingRef.update({ depositPaid: true, status: "requested", stripeDepositIntentId: pi.id });
          try {
            const tenant = await getTenantById(tenantId);
            if (tenant) {
              await sendBookingCreatedNotifications({
                booking: { ...booking, depositPaid: true },
                tenant,
                adminEmail: tenant.email || null,
              });
            }
          } catch (e) { console.error("Confirmation email failed:", e); }
        }

        // Full payment at booking time — unlock gallery immediately if it exists
        if (type === "full" && !booking.paidInFull) {
          await bookingRef.update({
            depositPaid: true,
            balancePaid: true,
            paidInFull:  true,
            remainingBalance: 0,
            status: "requested",
            stripeDepositIntentId: pi.id,
          });
          if (booking.galleryId) {
            await adminDb
              .collection("tenants").doc(tenantId)
              .collection("galleries").doc(booking.galleryId)
              .update({ unlocked: true });
          }
          try {
            const tenant = await getTenantById(tenantId);
            if (tenant) {
              await sendBookingCreatedNotifications({
                booking: { ...booking, depositPaid: true },
                tenant,
                adminEmail: tenant.email || null,
              });
            }
          } catch (e) { console.error("Confirmation email failed:", e); }
        }

        if (type === "balance" && !booking.balancePaid) {
          await bookingRef.update({ balancePaid: true, remainingBalance: 0, status: "completed" });
          if (booking.galleryId) {
            await adminDb
              .collection("tenants").doc(tenantId)
              .collection("galleries").doc(booking.galleryId)
              .update({ unlocked: true });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        const { bookingId, tenantId, type } = session.metadata || {};
        if (!bookingId || !tenantId || type !== "deposit") break;

        const bookingRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);

        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) break;
        const booking = bookingDoc.data();

        if (!booking.depositPaid) {
          await bookingRef.update({
            depositPaid: true,
            status: "requested",
            stripeDepositSessionId: session.id,
          });
          try {
            const tenant = await getTenantById(tenantId);
            if (tenant) {
              await sendBookingCreatedNotifications({
                booking: { ...booking, depositPaid: true },
                tenant,
                adminEmail: tenant.email || null,
              });
            }
          } catch (e) { console.error("Deposit confirmation email failed:", e); }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const { bookingId, tenantId } = pi.metadata;
        if (!bookingId || !tenantId) break;
        await adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId)
          .update({ status: "payment_failed" });
        break;
      }

      // Subscription events
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) break;
        await adminDb.collection("tenants").doc(tenantId).update({
          stripeSubscriptionId: sub.id,
          subscriptionStatus:   sub.status,
          subscriptionPlan:     sub.metadata?.plan || "starter",
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) break;
        await adminDb.collection("tenants").doc(tenantId).update({
          subscriptionStatus: "canceled",
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return new Response("OK", { status: 200 });
}
