// Canonical Stripe Connect validation for TENANT CLIENT payments.
//
// Business rule: KyoriaOS never accepts a tenant client's money without a
// verified, operational connected account and a confirmed transfer
// destination. There is NO platform-account fallback — payment creation fails
// closed with TENANT_PAYMENT_SETUP_INCOMPLETE.
//
// Merchant-of-record note: we use DESTINATION CHARGES on the platform account
// (transfer_data.destination + application_fee_amount) WITHOUT on_behalf_of.
// That means KyoriaOS is the settlement merchant / statement descriptor, and
// refunds & disputes live on the platform account. Adding on_behalf_of would
// shift merchant-of-record, descriptors, settlement currency, and dispute
// ownership to the connected account — do not add/remove it without an
// explicit business decision (documented in the payment-safety audit).

export const TENANT_PAYMENT_SETUP_INCOMPLETE = "TENANT_PAYMENT_SETUP_INCOMPLETE";

// Customer-safe message — never exposes Stripe/compliance details.
export const CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE =
  "This studio is temporarily unable to accept online payments. Please contact the studio directly.";

// Message for the authenticated tenant (dashboard routes).
export const TENANT_PAYMENT_SETUP_MESSAGE =
  "Complete or repair your Stripe payment setup before accepting online client payments.";

export class PaymentSetupError extends Error {
  constructor(reason) {
    super(TENANT_PAYMENT_SETUP_INCOMPLETE);
    this.code = TENANT_PAYMENT_SETUP_INCOMPLETE;
    this.reason = reason; // internal only — never sent to customers
  }
}

// ── Pure assessment of a retrieved Stripe account (unit-tested) ──────────────
// Returns { ok, status, reason }. `status` feeds the tenant-facing setup UI.
export function assessConnectAccount(account) {
  if (!account) return { ok: false, status: "account_missing", reason: "No Stripe account object" };
  if (account.deleted) return { ok: false, status: "account_disconnected", reason: "Account deleted/disconnected" };
  if (account.charges_enabled !== true) {
    return { ok: false, status: "charges_disabled", reason: account.requirements?.disabled_reason || "charges_enabled is false" };
  }
  if (account.payouts_enabled !== true) {
    return { ok: false, status: "payouts_disabled", reason: account.requirements?.disabled_reason || "payouts_enabled is false" };
  }
  const cardCap = account.capabilities?.card_payments;
  if (cardCap && cardCap !== "active") {
    return { ok: false, status: "capability_inactive", reason: `card_payments capability is ${cardCap}` };
  }
  if (account.requirements?.disabled_reason) {
    return { ok: false, status: "restricted", reason: account.requirements.disabled_reason };
  }
  if ((account.requirements?.currently_due || []).length > 0) {
    return { ok: false, status: "information_required", reason: `requirements currently due: ${account.requirements.currently_due.length}` };
  }
  return { ok: true, status: "connected", reason: null };
}

// ── Pure routing verification for a created/settled PaymentIntent ────────────
// Used post-create and in the webhook before any state change.
export function verifyPiRouting(pi, expectedDestination, expectedFeeCents = null) {
  const mismatches = [];
  const destination = pi?.transfer_data?.destination || null;
  if (!destination) mismatches.push("missing transfer destination (platform-only charge)");
  else if (expectedDestination && destination !== expectedDestination) {
    mismatches.push(`destination ${destination} does not match tenant account`);
  }
  if (expectedFeeCents != null) {
    const fee = pi?.application_fee_amount ?? null;
    if (fee !== expectedFeeCents) mismatches.push(`application fee ${fee} != expected ${expectedFeeCents}`);
  }
  return { ok: mismatches.length === 0, destination, mismatches };
}

// ── Live validation (retrieves the account from Stripe) ─────────────────────
// Short-lived in-memory cache; invalidated by the account.updated webhook
// (same-instance) and bounded by TTL everywhere else.
const CACHE_TTL_MS = 5 * 60 * 1000;
const accountCache = new Map(); // acctId -> { at, assessment }

export function invalidateAccountCache(accountId) {
  if (accountId) accountCache.delete(accountId);
}

/**
 * Validates that a tenant can safely receive client payments.
 * Returns the verified connected-account id, or throws PaymentSetupError.
 * NEVER trusts client input — callers must pass the server-loaded tenant doc.
 */
export async function requireTenantPaymentAccount(tenant, { stripeClient } = {}) {
  const accountId = tenant?.stripeConnectAccountId;
  if (!accountId || typeof accountId !== "string" || !accountId.startsWith("acct_")) {
    throw new PaymentSetupError("Tenant has no stored connected account id");
  }

  const cached = accountCache.get(accountId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    if (!cached.assessment.ok) throw new PaymentSetupError(cached.assessment.reason);
    return accountId;
  }

  let account;
  try {
    const s = stripeClient || (await import("@/lib/stripe")).stripe;
    account = await s.accounts.retrieve(accountId);
  } catch (e) {
    // Retrieval failure must NOT fall back to the platform account.
    throw new PaymentSetupError(`Stripe account retrieval failed: ${e?.message}`);
  }

  const assessment = assessConnectAccount(account);
  accountCache.set(accountId, { at: Date.now(), assessment });
  if (!assessment.ok) throw new PaymentSetupError(`${assessment.status}: ${assessment.reason}`);
  return accountId;
}

// Standard fail-closed HTTP responses.
export function customerPaymentBlockedResponse() {
  return Response.json(
    { error: CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE, code: TENANT_PAYMENT_SETUP_INCOMPLETE },
    { status: 403 }
  );
}
export function tenantPaymentBlockedResponse() {
  return Response.json(
    { error: TENANT_PAYMENT_SETUP_MESSAGE, code: TENANT_PAYMENT_SETUP_INCOMPLETE },
    { status: 403 }
  );
}
