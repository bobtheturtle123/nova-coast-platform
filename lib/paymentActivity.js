// Pure builder for payment activity-log entries. No firebase imports so it can
// be unit-tested directly; lib/activityLog.js persists what this returns.
//
// Idempotency: `key` is deterministic per Stripe object + payment type, so the
// webhook, a webhook retry, and the success-page verification fallback all
// write the SAME document (set + merge) instead of duplicating the entry.

const TYPE_LABEL = {
  deposit:  "booking deposit",
  balance:  "remaining balance",
  full:     "full payment",
  manual:   "manual payment",
  refund:   "refund",
  failed:   "payment",
};

function money(cents, currency = "usd") {
  const n = (Number(cents) || 0) / 100;
  const sym = currency.toLowerCase() === "usd" ? "$" : `${currency.toUpperCase()} `;
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Stable doc id for one logical payment event.
export function paymentActivityKey({ paymentType, piId, sessionId, chargeId, idKey }) {
  if (idKey) return idKey;
  if (paymentType === "refund" && chargeId) return `refund_${chargeId}`;
  if (paymentType === "failed" && piId)     return `payfail_${piId}`;
  const ref = piId || sessionId || chargeId;
  return ref ? `pay_${ref}` : `pay_${Date.now()}`;
}

/**
 * Build an idempotent payment activity entry.
 * Returns { key, doc } — doc has no undefined values (Firestore-safe merge)
 * and never contains card numbers / secrets.
 */
export function buildPaymentEntry({
  paymentType,            // deposit | balance | full | manual | refund | failed
  payerName = null,
  payerEmail = null,
  grossCents = 0,
  tipCents = 0,
  feeCents = null,        // platform fee (application_fee_amount); null = unknown
  currency = "usd",
  status = "succeeded",   // succeeded | failed | refunded
  piId = null,
  sessionId = null,
  chargeId = null,
  connectedAccountId = null,
  source = "stripe webhook",
  address = null,
  method = null,          // e.g. "card", "cash", "check" — category only
  idKey = null,           // explicit idempotency key for non-Stripe events
} = {}) {
  const who   = payerName || payerEmail || "The client";
  const gross = money(grossCents, currency);
  const label = TYPE_LABEL[paymentType] || "payment";

  let title;
  if (paymentType === "refund")       title = `A ${gross} refund was issued to ${who}.`;
  else if (paymentType === "failed")  title = `Payment of ${gross} from ${who} failed.`;
  else if (paymentType === "deposit") title = `${who} paid a ${gross} booking deposit.`;
  else if (paymentType === "balance") title = `${who} paid the remaining balance of ${gross}.`;
  else if (paymentType === "full")    title = `A full payment of ${gross} was received from ${who}.`;
  else                                title = `${who} paid ${gross} (${label}).`;

  const netCents = feeCents != null ? Math.max(0, (Number(grossCents) || 0) - (Number(feeCents) || 0)) : null;

  const lines = [
    `Amount paid: ${gross}`,
    tipCents > 0 ? `Includes tip: ${money(tipCents, currency)}` : null,
    feeCents != null ? `Platform fee: ${money(feeCents, currency)}` : null,
    netCents != null ? `Net to you (before Stripe processing fees): ${money(netCents, currency)}` : null,
    address ? `For: ${address}` : null,
    `Source: ${source}`,
    piId ? `Payment ID: ${piId}` : null,
    sessionId ? `Checkout session: ${sessionId}` : null,
    chargeId ? `Charge: ${chargeId}` : null,
  ].filter(Boolean);

  const doc = {
    type:       paymentType === "failed" ? "payment_failed" : paymentType === "refund" ? "refund" : "payment",
    paymentType,
    title,
    message:    lines.join("\n"),
    recipient:  payerEmail,
    payerName,
    grossCents: Math.round(Number(grossCents) || 0),
    tipCents:   Math.round(Number(tipCents) || 0),
    feeCents:   feeCents != null ? Math.round(Number(feeCents) || 0) : null,
    netCents,
    currency:   String(currency || "usd").toLowerCase(),
    status,
    method,
    stripePaymentIntentId: piId,
    stripeSessionId:       sessionId,
    stripeChargeId:        chargeId,
    connectedAccountId,
    viaConnect: !!connectedAccountId,
    source,
  };
  // Strip undefined so Firestore set(..., {merge:true}) never clobbers known
  // values written by another writer (e.g. webhook wrote the fee; the
  // verify fallback doesn't know it).
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

  return { key: paymentActivityKey({ paymentType, piId, sessionId, chargeId, idKey }), doc };
}
