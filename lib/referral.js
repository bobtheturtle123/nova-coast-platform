import { adminDb } from "./firebase-admin";
import { stripe } from "./stripe";
import { FieldValue } from "firebase-admin/firestore";

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
  if (stripeCustomerId) {
    try {
      await stripe.customers.createBalanceTransaction(stripeCustomerId, {
        amount:      -amountCents,
        currency:    "usd",
        description: "ShootFlow referral credit — $20",
      });
    } catch (err) {
      console.error("Stripe referral credit error:", err.message);
    }
  }
  await adminDb.collection("tenants").doc(tenantId).update({
    referralCredits:          FieldValue.increment(amountCents),
    referralRewardsThisMonth: FieldValue.increment(amountCents),
  });
}

export async function triggerReferralReward(refereeId, paymentRef) {
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

  // Monthly cap check ($200 default)
  const capCents         = referrer.referralRewardCap ?? 20000;
  const rewardsThisMonth = referrer.referralRewardsThisMonth || 0;
  if (rewardsThisMonth + 2000 > capCents) {
    await referralDoc.ref.update({ status: "blocked", blockedReason: "monthly_cap_exceeded" });
    return;
  }

  // Apply $20 credit to both parties
  await Promise.all([
    applyReferralCredit(referrerId, referrer.stripeCustomerId, 2000),
    applyReferralCredit(refereeId,  referee.stripeCustomerId,  2000),
  ]);

  await referralDoc.ref.update({
    status:          "rewarded",
    rewardedAt:      new Date(),
    paymentIntentId: paymentRef || null,
  });
}
