import { stripe, ADDON_PRICE_IDS } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { getTenantByStripeCustomerId, triggerReferralReward, applyPendingReferralCredits } from "@/lib/referral";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

// Notifications (email/SMS/agent portal) can be slow. We never let them hold the
// webhook response past this bound — Stripe treats a slow/no response as a failed
// delivery and retries, which is exactly the "other errors" we want to avoid. The
// critical Firestore writes are always awaited; only the side-effects are capped.
const NOTIFY_TIMEOUT_MS = 8000;
function withTimeout(promise, ms = NOTIFY_TIMEOUT_MS) {
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

// GET — liveness probe. Stripe (and you) can hit this to confirm the endpoint is reachable.
export async function GET() {
  return Response.json({ ok: true, endpoint: "stripe-webhook", ts: new Date().toISOString() });
}

export async function POST(req) {
  const sig     = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {

      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const { bookingId, type, tenantId } = pi.metadata;
        if (!bookingId || !tenantId) {
          console.warn(`[stripe/webhook] payment_intent.succeeded missing metadata — pi=${pi.id} bookingId=${bookingId} tenantId=${tenantId}`);
          break;
        }

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
            const data = snap.data();
            const newRemainingBalance = Math.max(0, (data.totalPrice || 0) - (data.depositAmount || 0));
            tx.update(bookingRef, {
              depositPaid: true,
              remainingBalance: newRemainingBalance,
              status: "requested",
              stripeDepositIntentId: pi.id,
            });
            shouldNotify = true;
          });
          if (shouldNotify) {
            console.log(`[stripe/webhook] deposit payment_intent.succeeded — notifying bookingId=${bookingId}`);
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                await withTimeout(sendBookingCreatedNotifications({
                  booking: { ...booking, depositPaid: true },
                  tenant,
                  adminEmail: tenant.email || null,
                }));
                sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" })
                  .catch((e) => console.error("[stripe/webhook] agent portal FAILED:", e?.message || e));
                sendBookingConfirmedSms({ booking, tenant })
                  .then(() => console.log(`[stripe/webhook] SMS sent for bookingId=${bookingId}`))
                  .catch((e) => console.error("[stripe/webhook] SMS FAILED:", e?.message || e));
                try {
                  const { dispatchZapier, bookingWebhookData } = await import("@/lib/zapier");
                  await dispatchZapier(tenant, "booking.paid", bookingWebhookData({ ...booking, depositPaid: true, status: "requested" }));
                } catch {}
              }
            } catch (e) { console.error("[stripe/webhook] deposit notification FAILED:", e?.message || e); }
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
            console.log(`[stripe/webhook] full payment_intent.succeeded — notifying bookingId=${bookingId}`);
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                await withTimeout(sendBookingCreatedNotifications({
                  booking: { ...booking, depositPaid: true },
                  tenant,
                  adminEmail: tenant.email || null,
                }));
                sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" })
                  .catch((e) => console.error("[stripe/webhook] agent portal FAILED:", e?.message || e));
                sendBookingConfirmedSms({ booking, tenant })
                  .then(() => console.log(`[stripe/webhook] SMS sent for bookingId=${bookingId}`))
                  .catch((e) => console.error("[stripe/webhook] SMS FAILED:", e?.message || e));
              }
            } catch (e) { console.error("[stripe/webhook] full payment notification FAILED:", e?.message || e); }
          }
        }

        if (type === "balance") {
          let balanceShouldNotify = false;
          let balanceGalleryId    = null;
          await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(bookingRef);
            if (!snap.exists || snap.data().balancePaid) return;
            balanceGalleryId = snap.data().galleryId || null;
            tx.update(bookingRef, {
              balancePaid: true,
              paidInFull: true,
              remainingBalance: 0,
              status: "completed",
              stripeBalanceIntentId: pi.id,
            });
            balanceShouldNotify = true;
          });
          if (balanceGalleryId) {
            await adminDb
              .collection("tenants").doc(tenantId)
              .collection("galleries").doc(balanceGalleryId)
              .update({ unlocked: true });
          }
          if (balanceShouldNotify) {
            console.log(`[stripe/webhook] balance payment_intent.succeeded — bookingId=${bookingId}`);
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                sendBookingConfirmedSms({ booking: { ...booking, balancePaid: true }, tenant })
                  .catch((e) => console.error("[stripe/webhook] balance SMS FAILED:", e?.message || e));
              }
            } catch (e) { console.error("[stripe/webhook] balance notification FAILED:", e?.message || e); }
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;
        const { bookingId, tenantId, type, pack, plan } = session.metadata || {};

        // Subscription checkout — write to Firestore immediately as a backup to
        // customer.subscription.created (which may fire late or be missed if webhook
        // is misconfigured). This dual-write ensures the tenant is unblocked right away.
        if (session.mode === "subscription" && session.subscription && tenantId) {
          await adminDb.collection("tenants").doc(tenantId).update({
            stripeSubscriptionId: session.subscription,
            subscriptionStatus:   "active",
            subscriptionPlan:     plan || "solo",
          });
          console.log(`[stripe/webhook] subscription checkout completed — tenant=${tenantId} plan=${plan || "solo"}`);
          break;
        }

        if (!tenantId) {
          console.warn(`[stripe/webhook] checkout.session.completed missing tenantId — session=${session.id}`);
          break;
        }

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

        if (!bookingId) {
          console.warn(`[stripe/webhook] checkout.session.completed missing bookingId — session=${session.id} type=${type}`);
          break;
        }

        const bookingRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);

        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) break;
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
            console.log(`[stripe/webhook] checkout deposit confirmed — bookingId=${bookingId}`);
            try {
              const tenant = await getTenantById(tenantId);
              if (tenant) {
                await withTimeout(sendBookingCreatedNotifications({
                  booking: { ...booking, depositPaid: true },
                  tenant,
                  adminEmail: tenant.email || null,
                }));
                sendAgentPortalEmail({ tenantId, booking, tenant, reason: "booking" }).catch(() => {});
                sendBookingConfirmedSms({ booking, tenant }).catch(() => {});
              }
            } catch (e) { console.error("[stripe/webhook] deposit notification FAILED:", e); }
          }
          break;
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
              .update({ unlocked: true });
          }
          if (shouldNotify) {
            console.log(`[stripe/webhook] checkout balance confirmed — bookingId=${bookingId}`);
          }
          break;
        }

        console.warn(`[stripe/webhook] checkout.session.completed unhandled type="${type}" session=${session.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const { bookingId, tenantId } = pi.metadata;
        if (!bookingId || !tenantId) {
          console.warn(`[stripe/webhook] payment_intent.payment_failed missing metadata — pi=${pi.id} bookingId=${bookingId} tenantId=${tenantId}`);
          break;
        }
        await adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId)
          .update({ status: "payment_failed" });
        break;
      }

      // Referral reward — fires on subscription payments.
      // We listen to BOTH the first invoice (subscription_create) AND renewals
      // (subscription_cycle). The reward has a 48h minimum-age guard to deter
      // trial-and-cancel abuse; since customers usually pay at signup, the first
      // invoice is always <48h old and the reward is DEFERRED. Without listening
      // to subscription_cycle, that deferred reward would never retry and the
      // $20 credit would never apply. triggerReferralReward is idempotent
      // (dedupes on paymentIntentId and only processes "pending" referrals), so
      // listening to renewals can't double-reward.
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (!["subscription_create", "subscription_cycle"].includes(invoice.billing_reason)) break;
        if (!invoice.customer) break;
        try {
          const tenant = await getTenantByStripeCustomerId(invoice.customer);
          if (tenant?.referredBy) {
            await triggerReferralReward(tenant.id, invoice.payment_intent || invoice.id);
          }
          // Flush any pending referral credit now that this tenant has a customer.
          if (tenant?.id && (tenant.pendingReferralCredits || 0) > 0) {
            await applyPendingReferralCredits(tenant.id, invoice.customer);
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
          // Whether the sub is set to cancel at period end (still active until then).
          cancelAtPeriodEnd:     !!sub.cancel_at_period_end,
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
          cancelAtPeriodEnd:  false,
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
