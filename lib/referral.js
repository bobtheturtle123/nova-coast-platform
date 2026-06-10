import { adminDb } from "./firebase-admin";
import { stripe } from "./stripe";
import { FieldValue } from "firebase-admin/firestore";
import { notifyTenant } from "./notify";

export function generateReferralCode(businessName) {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug}-${rand}`;
}

export async function getTenantByReferralCode(code) {
  if (!code) return null;
  const snap = await adminDb
    .collection("tenants")
    .where("referralCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getTenantByStripeCustomerId(customerId) {
  if (!customerId) return null;
  const snap = await adminDb
    .collection("tenants")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createReferralRecord({ referrerId, refereeId, refereeEmail }) {
  const ref = adminDb.collection("referrals").doc();
  await ref.set({
    id:            ref.id,
    referrerId,
    refereeId,
    refereeEmail:  refereeEmail || null,
    status:        "pending",
    signedUpAt:    new Date(),
    rewardedAt:    null,
    paymentIntentId: null,
    blockedReason: null,
  });
  return ref.id;
}

export async function applyReferralCredit(tenantId, stripeCustomerId, amountCents) {
  // A NEGATIVE customer balance is a credit that Stripe automatically applies to
  // the customer's NEXT invoice — so the reward is real money off their next
  // bill, not just a number in our UI.
  //
  // If the tenant has no Stripe customer yet (e.g. still on trial, no card),
  // we can't apply it in Stripe. Rather than show a phantom credit, we record it
  // as PENDING and flush it the moment they get a customer (see
  // applyPendingReferralCredits, called from the Stripe webhook).
  if (stripeCustomerId) {
    // Let errors propagate so triggerReferralReward won't mark "rewarded" on failure.
    await stripe.customers.createBalanceTransaction(stripeCustomerId, {
      amount:      -amountCents,
      currency:    "usd",
      description: "KyoriaOS referral credit ($20) — applied to your next invoice",
      metadata:    { type: "referral_credit", tenantId },
    });
    await adminDb.collection("tenants").doc(tenantId).update({
      referralCredits:          FieldValue.increment(amountCents),
      referralRewardsThisMonth: FieldValue.increment(amountCents),
    });
    return;
  }

  // No customer yet — hold it as pending so it isn't lost or shown as usable.
  await adminDb.collection("tenants").doc(tenantId).update({
    pendingReferralCredits: FieldValue.increment(amountCents),
  });
}

// Flush any pending referral credit onto a tenant's Stripe customer (called from
// the webhook once they have a customer / subscription). Idempotent: moves
// pending → applied and zeroes the pending counter.
export async function applyPendingReferralCredits(tenantId, stripeCustomerId) {
  if (!stripeCustomerId) return;
  const ref  = adminDb.collection("tenants").doc(tenantId);
  const snap = await ref.get();
  const pending = Math.round(snap.data()?.pendingReferralCredits || 0);
  if (pending <= 0) return;

  await stripe.customers.createBalanceTransaction(stripeCustomerId, {
    amount:      -pending,
    currency:    "usd",
    description: "KyoriaOS referral credit — applied to your next invoice",
    metadata:    { type: "referral_credit_pending", tenantId },
  });
  await ref.update({
    pendingReferralCredits:   0,
    referralCredits:          FieldValue.increment(pending),
    referralRewardsThisMonth: FieldValue.increment(pending),
  });
}

export async function triggerReferralReward(refereeId, paymentRef) {
  // Idempotency: if this paymentRef was already processed, skip
  if (paymentRef) {
    const alreadyProcessed = await adminDb
      .collection("referrals")
      .where("paymentIntentId", "==", paymentRef)
      .limit(1)
      .get();
    if (!alreadyProcessed.empty) return;
  }

  const snap = await adminDb
    .collection("referrals")
    .where("refereeId", "==", refereeId)
    .where("status",    "==", "pending")
    .limit(1)
    .get();
  if (snap.empty) return;

  const referralDoc = snap.docs[0];
  const referral    = referralDoc.data();
  const referrerId  = referral.referrerId;

  // Self-referral guard
  if (referrerId === refereeId) {
    await referralDoc.ref.update({ status: "blocked", blockedReason: "self_referral" });
    return;
  }

  const [referrerDoc, refereeDoc] = await Promise.all([
    adminDb.collection("tenants").doc(referrerId).get(),
    adminDb.collection("tenants").doc(refereeId).get(),
  ]);
  if (!referrerDoc.exists || !refereeDoc.exists) return;

  const referrer = referrerDoc.data();
  const referee  = refereeDoc.data();

  // Minimum subscription age: referee must have signed up at least 48 hours ago
  // to filter out trial-and-cancel abuse patterns.
  const signedUpAt = referral.signedUpAt?.toDate?.() || referral.signedUpAt;
  if (signedUpAt && Date.now() - new Date(signedUpAt).getTime() < 48 * 60 * 60 * 1000) {
    // Defer — don't block, but don't reward yet (webhook will retry on next invoice event)
    return;
  }

  // Same card fingerprint check
  if (referrer.stripeCustomerId && referee.stripeCustomerId) {
    try {
      const [referrerPMs, refereePMs] = await Promise.all([
        stripe.paymentMethods.list({ customer: referrer.stripeCustomerId, type: "card", limit: 5 }),
        stripe.paymentMethods.list({ customer: referee.stripeCustomerId,  type: "card", limit: 5 }),
      ]);
      const referrerPrints = new Set(
        referrerPMs.data.map((m) => m.card?.fingerprint).filter(Boolean)
      );
      const sameCard = refereePMs.data.some((m) => referrerPrints.has(m.card?.fingerprint));
      if (sameCard) {
        await referralDoc.ref.update({ status: "blocked", blockedReason: "same_payment_method" });
        return;
      }
    } catch { /* don't block legitimate referrals on Stripe API errors */ }
  }

  // Monthly cap check — auto-reset if we're in a new calendar month
  const capCents = referrer.referralRewardCap ?? 20000;
  const now = new Date();
  const capResetMonth = referrer.referralCapResetMonth; // "YYYY-MM"
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rewardsThisMonth = capResetMonth === thisMonth ? (referrer.referralRewardsThisMonth || 0) : 0;

  if (rewardsThisMonth + 2000 > capCents) {
    await referralDoc.ref.update({ status: "blocked", blockedReason: "monthly_cap_exceeded" });
    return;
  }

  // If month rolled over, reset the counter before applying reward
  const referrerUpdates = {};
  if (capResetMonth !== thisMonth) {
    referrerUpdates.referralRewardsThisMonth = 0;
    referrerUpdates.referralCapResetMonth    = thisMonth;
  }

  // Apply $20 credit to both parties
  await Promise.all([
    applyReferralCredit(referrerId, referrer.stripeCustomerId, 2000),
    applyReferralCredit(refereeId,  referee.stripeCustomerId,  2000),
  ]);

  if (Object.keys(referrerUpdates).length > 0) {
    await adminDb.collection("tenants").doc(referrerId).update(referrerUpdates);
  }

  await referralDoc.ref.update({
    status:          "rewarded",
    rewardedAt:      new Date(),
    paymentIntentId: paymentRef || null,
  });

  // In-app notifications for both parties that the $20 credit landed.
  await Promise.all([
    notifyTenant(referrerId, {
      type: "referral",
      title: "You earned a $20 referral credit",
      body: "Someone you referred subscribed. The credit has been applied to your account.",
      link: "/dashboard/billing",
    }),
    notifyTenant(refereeId, {
      type: "referral",
      title: "Your $20 welcome credit was applied",
      body: "Thanks for joining through a referral. The credit is on your account.",
      link: "/dashboard/billing",
    }),
  ]);
}
