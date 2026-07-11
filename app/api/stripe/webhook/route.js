import { stripe, ADDON_PRICE_IDS } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { getTenantByStripeCustomerId, triggerReferralReward, applyPendingReferralCredits } from "@/lib/referral";
import { logPaymentActivity } from "@/lib/activityLog";

// Idempotent payment activity entry from a PaymentIntent (fire-and-forget —
// deterministic doc key means webhook retries and the success-page fallback
// all land on the same entry).
function logPiActivity(tenantId, bookingId, booking, pi, paymentType, { sessionId = null, source = "stripe webhook" } = {}) {
  logPaymentActivity(tenantId, bookingId, {
    paymentType,
    payerName:  booking?.clientName  || pi.metadata?.clientName || null,
    payerEmail: booking?.clientEmail || pi.receipt_email || null,
    grossCents: pi.amount_received ?? pi.amount ?? 0,
    tipCents:   paymentType !== "balance" ? Math.round((Number(booking?.tipAmount) || 0) * 100) : 0,
    feeCents:   pi.application_fee_amount ?? null,
    currency:   pi.currency || "usd",
    status:     paymentType === "failed" ? "failed" : "succeeded",
    piId:       pi.id,
    sessionId,
    chargeId:   typeof pi.latest_charge === "string" ? pi.latest_charge : null,
    connectedAccountId: pi.transfer_data?.destination || null,
    source,
    address:    booking?.fullAddress || booking?.address || null,
    method:     "card",
  });
}

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

        // TENANT CLIENT PAYMENT ROUTING VERIFICATION — a succeeded payment
        // without a verified transfer destination (or with the wrong one)
        // must never mark work paid, unlock media, or reduce a balance.
        if (["deposit", "full", "balance"].includes(type)) {
          const routingTenant = await adminDb.collection("tenants").doc(tenantId).get();
          const expectedAcct  = routingTenant.data()?.stripeConnectAccountId || null;
          const { verifyPiRouting } = await import("@/lib/connect");
          const routing = verifyPiRouting(pi, expectedAcct);
          if (!routing.ok) {
            const { sendCriticalAlert } = await import("@/lib/alerts");
            await sendCriticalAlert({
              type: routing.destination ? "payment_destination_mismatch" : "platform_only_payment",
              tenantId, bookingId, paymentId: pi.id,
              expected: { destination: expectedAcct },
              actual:   { destination: routing.destination, feeCents: pi.application_fee_amount ?? null },
              amountCents: pi.amount_received ?? pi.amount ?? 0,
              message: `payment_intent.succeeded blocked from finalizing: ${routing.mismatches.join("; ")}`,
            });
            // Operational record only — NOT a completed customer payment.
            logPaymentActivity(tenantId, bookingId, {
              paymentType: "blocked",
              status:      "routing_failed",
              grossCents:  pi.amount_received ?? pi.amount ?? 0,
              piId:        pi.id,
              source:      "stripe webhook (routing verification)",
              idKey:       `routingfail_${pi.id}`,
            });
            break;
          }
        }

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
          logPiActivity(tenantId, bookingId, booking, pi, "deposit");
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
              .update({ unlocked: true, unlockedAt: new Date() });
          }
          logPiActivity(tenantId, bookingId, booking, pi, "full");
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
              .update({ unlocked: true, unlockedAt: new Date() });
          }
          logPiActivity(tenantId, bookingId, booking, pi, "balance");
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

        // Routing verification for checkout payments (deposit/balance links) —
        // retrieve the PI once; block finalization on any routing mismatch.
        let sessionPi = null;
        if (["deposit", "balance"].includes(type)) {
          try {
            if (session.payment_intent) sessionPi = await stripe.paymentIntents.retrieve(session.payment_intent);
          } catch {}
          const routingTenant = await adminDb.collection("tenants").doc(tenantId).get();
          const expectedAcct  = routingTenant.data()?.stripeConnectAccountId || null;
          const { verifyPiRouting } = await import("@/lib/connect");
          const routing = verifyPiRouting(sessionPi, expectedAcct);
          if (!routing.ok) {
            const { sendCriticalAlert } = await import("@/lib/alerts");
            await sendCriticalAlert({
              type: routing.destination ? "payment_destination_mismatch" : "platform_only_payment",
              tenantId, bookingId, paymentId: sessionPi?.id || session.id,
              expected: { destination: expectedAcct },
              actual:   { destination: routing.destination, feeCents: sessionPi?.application_fee_amount ?? null },
              amountCents: session.amount_total ?? 0,
              message: `checkout.session.completed blocked from finalizing: ${routing.mismatches.join("; ")}`,
            });
            logPaymentActivity(tenantId, bookingId, {
              paymentType: "blocked",
              status:      "routing_failed",
              grossCents:  session.amount_total ?? 0,
              piId:        sessionPi?.id || null,
              sessionId:   session.id,
              source:      "stripe webhook (routing verification)",
              idKey:       `routingfail_${sessionPi?.id || session.id}`,
            });
            break;
          }
        }

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
          if (sessionPi) logPiActivity(tenantId, bookingId, booking, sessionPi, "deposit", { sessionId: session.id, source: "stripe webhook (checkout)" });
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
              .update({ unlocked: true, unlockedAt: new Date() });
          }
          if (sessionPi) logPiActivity(tenantId, bookingId, booking, sessionPi, "balance", { sessionId: session.id, source: "stripe webhook (checkout)" });
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
        const failedRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);
        await failedRef.update({ status: "payment_failed" });
        const failedBooking = (await failedRef.get()).data() || null;
        logPiActivity(tenantId, bookingId, failedBooking, pi, "failed");
        break;
      }

      // Refund issued (full or partial) — record it on the listing's activity.
      // amount_refunded is cumulative, and the entry key is the charge id, so
      // partial refunds update one entry with the running total.
      case "charge.refunded": {
        const charge = event.data.object;
        const { bookingId, tenantId } = charge.metadata || {};
        if (!bookingId || !tenantId) {
          console.warn(`[stripe/webhook] charge.refunded missing metadata — charge=${charge.id}`);
          break;
        }
        const refundBookingRef = adminDb
          .collection("tenants").doc(tenantId)
          .collection("bookings").doc(bookingId);
        const refundBookingDoc = await refundBookingRef.get();
        if (!refundBookingDoc.exists) break;
        const refundBooking = refundBookingDoc.data();
        const refundedCents = charge.amount_refunded || 0;
        await refundBookingRef.update({
          refundedAmount: refundedCents / 100,
          lastRefundAt:   new Date(),
        }).catch(() => {});
        logPaymentActivity(tenantId, bookingId, {
          paymentType: "refund",
          status:      "refunded",
          payerName:   refundBooking.clientName  || null,
          payerEmail:  refundBooking.clientEmail || null,
          grossCents:  refundedCents,
          currency:    charge.currency || "usd",
          piId:        typeof charge.payment_intent === "string" ? charge.payment_intent : null,
          chargeId:    charge.id,
          connectedAccountId: charge.transfer_data?.destination || null,
          source:      "stripe webhook (refund)",
          address:     refundBooking.fullAddress || refundBooking.address || null,
        });
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

      // Connected-account status changed — keep the tenant record truthful and
      // invalidate the payment-validation cache so fail-closed checks see the
      // new state immediately.
      case "account.updated": {
        const account = event.data.object;
        const tSnap = await adminDb.collection("tenants")
          .where("stripeConnectAccountId", "==", account.id).limit(1).get();
        if (tSnap.empty) break;
        const { assessConnectAccount, invalidateAccountCache } = await import("@/lib/connect");
        invalidateAccountCache(account.id);
        const assessment = assessConnectAccount(account);
        await tSnap.docs[0].ref.update({
          stripeConnectChargesEnabled: account.charges_enabled === true,
          stripeConnectPayoutsEnabled: account.payouts_enabled === true,
          stripeConnectStatus:         assessment.status,
          stripeConnectStatusReason:   assessment.reason || null,
          // Keep the legacy boolean truthful — it must never claim "onboarded"
          // for an account that can't charge or receive payouts.
          stripeConnectOnboarded:      assessment.ok,
          stripeConnectUpdatedAt:      new Date(),
        });
        if (!assessment.ok) {
          const { sendCriticalAlert } = await import("@/lib/alerts");
          sendCriticalAlert({
            type: "connect_account_restricted",
            tenantId: tSnap.docs[0].id,
            expected: { status: "connected" },
            actual:   { status: assessment.status },
            message:  `Stripe account ${assessment.status}: ${assessment.reason || "see Stripe dashboard"} — online client payments are disabled for this tenant.`,
          }).catch(() => {});
        }
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
