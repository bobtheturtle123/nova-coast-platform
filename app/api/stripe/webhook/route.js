import { stripe } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { getTenantByStripeCustomerId, triggerReferralReward } from "@/lib/referral";

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

        if (type === "deposit") {
          // Use a transaction so concurrent Stripe retries don't double-notify
          let shouldNotify = false;
          await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(bookingRef);
            if (!snap.exists || snap.data().depositPaid) return;
            tx.update(bookingRef, { depositPaid: true, status: "requested", stripeDepositIntentId: pi.id });
            shouldNotify = true;
          });
          if (shouldNotify) {
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                await sendBookingCreatedNotifications({
                  booking: { ...booking, depositPaid: true },
                  tenant,
                  adminEmail: tenant.email || null,
                });
                sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" }).catch(() => {});
                sendBookingConfirmedSms({ booking, tenant }).catch(() => {});
              }
            } catch (e) { console.error("Confirmation email failed:", e); }
          }
        }

        // Full payment at booking time — unlock gallery immediately if it exists
        if (type === "full") {
          let shouldNotify = false;
          let galleryId    = null;
          await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(bookingRef);
            if (!snap.exists || snap.data().paidInFull) return;
            galleryId = snap.data().galleryId || null;
            tx.update(bookingRef, {
              depositPaid: true, balancePaid: true, paidInFull: true,
              remainingBalance: 0, status: "requested", stripeDepositIntentId: pi.id,
            });
            shouldNotify = true;
          });
          if (galleryId) {
            await adminDb
              .collection("tenants").doc(tenantId)
              .collection("galleries").doc(galleryId)
              .update({ unlocked: true });
          }
          if (shouldNotify) {
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                await sendBookingCreatedNotifications({
                  booking: { ...booking, depositPaid: true },
                  tenant,
                  adminEmail: tenant.email || null,
                });
                sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" }).catch(() => {});
                sendBookingConfirmedSms({ booking, tenant }).catch(() => {});
              }
            } catch (e) { console.error("Confirmation email failed:", e); }
          }
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
        const { bookingId, tenantId, type, pack } = session.metadata || {};
        if (!tenantId) break;

        // One-time listing credit top-up
        if (type === "topup" && pack) {
          const TOPUP_CREDITS = { pack25: 25, pack50: 50, pack100: 100 };
          const credits = TOPUP_CREDITS[pack] || 0;
          if (credits > 0) {
            await adminDb.collection("tenants").doc(tenantId).update({
              addonListings: FieldValue.increment(credits),
            });
          }
          break;
        }

        // Booking deposit via Checkout session
        if (type !== "deposit" || !bookingId) break;

        const bookingRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);

        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) break;
        const booking = bookingDoc.data();

        let checkoutShouldNotify = false;
        await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(bookingRef);
          if (!snap.exists || snap.data().depositPaid) return;
          tx.update(bookingRef, { depositPaid: true, status: "requested", stripeDepositSessionId: session.id });
          checkoutShouldNotify = true;
        });
        if (checkoutShouldNotify) {
          try {
            const tenant = await getTenantById(tenantId);
            if (tenant) {
              await sendBookingCreatedNotifications({
                booking: { ...booking, depositPaid: true },
                tenant,
                adminEmail: tenant.email || null,
              });
              sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" }).catch(() => {});
              sendBookingConfirmedSms({ booking, tenant }).catch(() => {});
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

      // Referral reward — fires on first successful subscription payment only
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason !== "subscription_create") break;
        if (!invoice.customer) break;
        try {
          const refereeTenant = await getTenantByStripeCustomerId(invoice.customer);
          if (refereeTenant?.referredBy) {
            await triggerReferralReward(refereeTenant.id, invoice.payment_intent || invoice.id);
          }
        } catch (err) {
          console.error("Referral reward error:", err.message);
        }
        break;
      }

      // Subscription events
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub    = event.data.object;
        const meta   = sub.metadata || {};
        const { type, tenantId, agentId } = meta;

        // Agent Pro — per-agent subscription from the agent portal
        if (type === "agentPro" && tenantId && agentId) {
          const isActive = sub.status === "active" || sub.status === "trialing";
          await adminDb
            .collection("tenants").doc(tenantId)
            .collection("agents").doc(agentId)
            .update({
              isAgentPro:               isActive,
              agentProSubscriptionId:   sub.id,
              agentProSubscriptionStatus: sub.status,
            });
          break;
        }

        // Agent Pro Platform — photographer enables for all agents
        if (type === "agentProPlatform" && tenantId) {
          const isActive = sub.status === "active" || sub.status === "trialing";
          await adminDb.collection("tenants").doc(tenantId).update({
            agentProActive:               isActive,
            agentProSubscriptionId:       sub.id,
            agentProSubscriptionStatus:   sub.status,
          });
          break;
        }

        // Regular platform subscription
        if (!tenantId) break;

        const { ADDON_PRICE_IDS } = await import("@/lib/stripe");

        // Count seat add-ons from subscription line items
        let addonSeats = 0;
        for (const item of sub.items?.data || []) {
          const priceId = item.price?.id;
          const qty     = item.quantity || 1;
          if (!priceId) continue;
          if (priceId === ADDON_PRICE_IDS.extraSeat) addonSeats += qty;
        }

        await adminDb.collection("tenants").doc(tenantId).update({
          stripeSubscriptionId:  sub.id,
          subscriptionStatus:    sub.status,
          subscriptionPlan:      meta.plan || "solo",
          subscriptionRenewalAt: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null,
          addonSeats,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub    = event.data.object;
        const meta   = sub.metadata || {};
        const { type, tenantId, agentId } = meta;

        // Agent Pro per-agent
        if (type === "agentPro" && tenantId && agentId) {
          await adminDb
            .collection("tenants").doc(tenantId)
            .collection("agents").doc(agentId)
            .update({ isAgentPro: false, agentProSubscriptionStatus: "canceled" });
          break;
        }

        // Agent Pro platform-wide
        if (type === "agentProPlatform" && tenantId) {
          await adminDb.collection("tenants").doc(tenantId).update({
            agentProActive: false,
            agentProSubscriptionStatus: "canceled",
          });
          break;
        }

        if (!tenantId) break;
        await adminDb.collection("tenants").doc(tenantId).update({
          subscriptionStatus: "canceled",
          addonSeats:         0,
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
