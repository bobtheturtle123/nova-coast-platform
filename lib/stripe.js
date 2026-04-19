import Stripe from "stripe";

// Platform Stripe instance (used for subscriptions + connect)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────────────────────


// Per-plan Stripe Price IDs (set in .env)
export const PLAN_PRICE_IDS = {
  solo:   process.env.STRIPE_PRICE_SOLO,
  studio: process.env.STRIPE_PRICE_STUDIO,
  pro:    process.env.STRIPE_PRICE_PRO,
  scale:  process.env.STRIPE_PRICE_SCALE,
  // Yearly variants
  solo_yearly:   process.env.STRIPE_PRICE_SOLO_YEARLY,
  studio_yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY,
  pro_yearly:    process.env.STRIPE_PRICE_PRO_YEARLY,
  scale_yearly:  process.env.STRIPE_PRICE_SCALE_YEARLY,
};

// Add-on Stripe Price IDs
export const ADDON_PRICE_IDS = {
  listings25: process.env.STRIPE_PRICE_ADDON_LISTINGS25,
  listings50: process.env.STRIPE_PRICE_ADDON_LISTINGS50,
  extraSeat:  process.env.STRIPE_PRICE_ADDON_SEAT,
  byop:       process.env.STRIPE_PRICE_ADDON_BYOP,
};

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
      url: process.env.NEXT_PUBLIC_APP_URL,
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
export async function createConnectOnboardingLink(accountId) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const link = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${appUrl}/dashboard/billing?connect=refresh`,
    return_url:  `${appUrl}/api/connect/return?account=${accountId}`,
    type:        "account_onboarding",
  });
  return link.url;
}

/**
 * Create a payment intent that routes funds to the connected account
 * minus a platform fee. Fee is per-plan with a $1.50 minimum floor.
 * Pass hasByop=true to waive the fee for BYOP tenants.
 */
export async function createConnectedPaymentIntent({
  amountCents,
  connectedAccountId,
  metadata = {},
  description = "",
  receiptEmail = null,
  planId = "solo",
  hasByop = false,
}) {
  const { calculatePlatformFee } = await import("@/lib/plans");
  const feeAmount = calculatePlatformFee(amountCents, planId, hasByop);

  const intentData = {
    amount:   amountCents,
    currency: "usd",
    transfer_data: { destination: connectedAccountId },
    metadata,
    description,
    receipt_email: receiptEmail,
  };

  if (feeAmount > 0) {
    intentData.application_fee_amount = feeAmount;
  }

  return stripe.paymentIntents.create(intentData);
}
