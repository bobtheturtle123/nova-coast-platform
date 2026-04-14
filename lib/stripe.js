import Stripe from "stripe";

// Platform Stripe instance (used for subscriptions + connect)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PLANS
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,   // $49/mo
  pro:     process.env.STRIPE_PRICE_PRO,        // $99/mo
  agency:  process.env.STRIPE_PRICE_AGENCY,     // $199/mo
};

// Platform fee taken from each booking (basis points, e.g. 150 = 1.5%)
export const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS || "150");

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
    settings: {
      losses: {
        payments: "stripe",
      },
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
 * minus a platform fee.
 */
export async function createConnectedPaymentIntent({
  amountCents,
  connectedAccountId,
  metadata = {},
  description = "",
  receiptEmail = null,
}) {
  const feeAmount = Math.round(amountCents * (PLATFORM_FEE_BPS / 10000));

  return stripe.paymentIntents.create({
    amount:   amountCents,
    currency: "usd",
    transfer_data: {
      destination: connectedAccountId,
    },
    application_fee_amount: feeAmount,
    metadata,
    description,
    receipt_email: receiptEmail,
  });
}
