import Stripe from "stripe";
import { getAppUrl } from "@/lib/appUrl";

// Platform Stripe instance (used for subscriptions + connect)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

// Builds a consistent, human-readable charge description used across every
// payment flow. Shows in the Stripe Dashboard and on the client's Stripe
// receipt, e.g. "Acme Media · Deposit for real estate photography — 123 Main St".
// (Stripe's own account-notification email template can't be customized; this
// is the text we control.)
export function paymentDescription(type, { businessName, address } = {}) {
  const label = {
    deposit: "Deposit for real estate photography",
    balance: "Balance for real estate photography",
    full:    "Real estate photography",
    invoice: "Invoice for real estate photography",
  }[type] || "Real estate photography";
  const biz  = (businessName || "").trim();
  const site = (address || "").trim();
  return [biz && `${biz} ·`, label, site && `— ${site}`].filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────────────────────


// Per-plan Stripe Price IDs. Env vars override; the hardcoded values are the
// current live monthly Prices so checkout works without extra env config.
// Price IDs are not secret (only the secret key is) — safe to keep in code.
export const PLAN_PRICE_IDS = {
  solo:   process.env.STRIPE_PRICE_SOLO   || "price_1TgT3b8qTZhsQAKq4RR4khl4",
  studio: process.env.STRIPE_PRICE_STUDIO || "price_1TgT4J8qTZhsQAKqis91fRK1",
  pro:    process.env.STRIPE_PRICE_PRO    || "price_1TgT4p8qTZhsQAKqWwsDptOT",
  scale:  process.env.STRIPE_PRICE_SCALE  || "price_1TgT5c8qTZhsQAKq1y7ukbYA",
  // Yearly variants (optional — only needed if offering annual billing)
  solo_yearly:   process.env.STRIPE_PRICE_SOLO_YEARLY,
  studio_yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY,
  pro_yearly:    process.env.STRIPE_PRICE_PRO_YEARLY,
  scale_yearly:  process.env.STRIPE_PRICE_SCALE_YEARLY,
};

// Monthly recurring seat add-on
export const ADDON_PRICE_IDS = {
  extraSeat: process.env.STRIPE_PRICE_ADDON_SEAT,
};

// Listing credit top-up packs
export const TOPUP_PRICE_IDS = {
  pack25:  process.env.STRIPE_PRICE_ADDON_LISTINGS25,
  pack50:  process.env.STRIPE_PRICE_ADDON_LISTINGS50,
  pack100: process.env.STRIPE_PRICE_ADDON_LISTINGS100,
};

// Agent Pro — per-agent recurring subscription
export const AGENT_PRO_PRICE_ID = process.env.STRIPE_PRICE_AGENT_PRO;

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE CONNECT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Connect Express account for a tenant.
 */
export async function createConnectAccount({ email, businessName }) {
  const account = await stripe.accounts.create({
    type: "express",
    email,
    business_type: "individual",
    business_profile: {
      name: businessName,
      mcc: "7221", // Photography studios
      url: getAppUrl(),
    },
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
  });
  return account;
}

/**
 * Generate a Connect onboarding link for a tenant.
 */
export async function createConnectOnboardingLink(accountId, returnTo = "billing") {
  const appUrl = getAppUrl();
  const link = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${appUrl}/api/connect/return?account=${accountId}&to=${returnTo}&refresh=1`,
    return_url:  `${appUrl}/api/connect/return?account=${accountId}&to=${returnTo}`,
    type:        "account_onboarding",
  });
  return link.url;
}

/**
 * Create a payment intent that routes funds to the connected account minus the
 * canonical per-plan platform fee (Solo/Studio 2%, Pro 1.5%, Scale 1.25%,
 * fee-exempt 0%, $1.50 floor on fee-bearing plans).
 *
 * Safety: after creation the PI's routing is ASSERTED — if the transfer
 * destination or application fee doesn't match what we intended, the PI is
 * cancelled, a critical alert fires, and the call throws. A tenant client
 * payment can never silently settle to the wrong account.
 */
export async function createConnectedPaymentIntent({
  amountCents,
  connectedAccountId,
  metadata = {},
  description = "",
  receiptEmail = null,
  planId = "solo",
  idempotencyKey = null,
}) {
  const { calculatePlatformFee, getPlan } = await import("@/lib/plans");
  const cents     = Math.round(Number(amountCents) || 0);
  const feeAmount = calculatePlatformFee(cents, planId);
  const plan      = getPlan(planId);

  const intentData = {
    amount:   cents,
    currency: "usd",
    transfer_data: { destination: connectedAccountId },
    metadata: {
      ...metadata,
      plan:             plan.id,
      feeBps:           String(plan.transactionFeeBps),
      feeCents:         String(feeAmount),
      expectedNetCents: String(Math.max(0, cents - feeAmount)),
    },
    description,
    receipt_email: receiptEmail,
  };

  if (feeAmount > 0) {
    intentData.application_fee_amount = feeAmount;
  }

  const pi = await stripe.paymentIntents.create(
    intentData,
    idempotencyKey ? { idempotencyKey } : undefined
  );

  // Post-create routing assertion (fail closed on any mismatch).
  const { verifyPiRouting } = await import("@/lib/connect");
  const routing = verifyPiRouting(pi, connectedAccountId, feeAmount > 0 ? feeAmount : null);
  if (!routing.ok) {
    try { await stripe.paymentIntents.cancel(pi.id); } catch {}
    const { sendCriticalAlert } = await import("@/lib/alerts");
    sendCriticalAlert({
      type: "payment_routing_mismatch",
      tenantId: metadata.tenantId || null,
      bookingId: metadata.bookingId || null,
      paymentId: pi.id,
      expected: { destination: connectedAccountId, feeCents: feeAmount },
      actual:   { destination: routing.destination, feeCents: pi.application_fee_amount ?? null },
      amountCents: cents,
      message: routing.mismatches.join("; "),
    }).catch(() => {});
    throw new Error("Payment routing verification failed");
  }

  return pi;
}

/**
 * Connected payment_intent_data + enriched metadata for Checkout Sessions —
 * the single way tenant-client checkout links attach their fee + destination.
 */
export async function buildConnectedSessionPaymentData({ amountCents, connectedAccountId, planId, metadata = {} }) {
  const { calculatePlatformFee, getPlan } = await import("@/lib/plans");
  const cents = Math.round(Number(amountCents) || 0);
  const fee   = calculatePlatformFee(cents, planId);
  const plan  = getPlan(planId);
  const enriched = {
    ...metadata,
    plan:             plan.id,
    feeBps:           String(plan.transactionFeeBps),
    feeCents:         String(fee),
    expectedNetCents: String(Math.max(0, cents - fee)),
  };
  const paymentIntentData = {
    metadata: enriched,
    transfer_data: { destination: connectedAccountId },
    ...(fee > 0 ? { application_fee_amount: fee } : {}),
  };
  return { paymentIntentData, enrichedMetadata: enriched, feeCents: fee };
}
