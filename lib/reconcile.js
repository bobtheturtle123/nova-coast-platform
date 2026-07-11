// Pure classification logic for the historical payment reconciliation.
// Given a normalized payment record + tenant expectations, returns the
// discrepancy flags and the remediation math. No I/O — unit-tested directly.

import { calculatePlatformFee } from "@/lib/plans";

/**
 * @param {object} p normalized payment
 *   { piId, tenantId, bookingId, type, grossCents, currency, destination,
 *     applicationFeeCents, refundedCents, disputed, stripeFeeCents }
 * @param {object} expectations
 *   { expectedDestination, planId }
 */
export function classifyPayment(p, { expectedDestination, planId }) {
  const flags = [];
  const gross = Math.max(0, Math.round(Number(p.grossCents) || 0));
  const authorizedFeeCents = calculatePlatformFee(gross, planId);
  const actualFeeCents = p.applicationFeeCents != null ? Math.round(Number(p.applicationFeeCents)) : null;
  const viaConnect = !!p.destination;

  if (!viaConnect) {
    flags.push("PLATFORM_ONLY_PAYMENT"); // customer money settled to the platform account
  } else if (expectedDestination && p.destination !== expectedDestination) {
    flags.push("WRONG_DESTINATION");
  }

  // With destination charges the transfer happens automatically (gross - fee),
  // so a missing destination === missing transfer.
  if (!viaConnect) flags.push("MISSING_TRANSFER");

  if (viaConnect && actualFeeCents != null && actualFeeCents > authorizedFeeCents) {
    flags.push("EXCESS_PLATFORM_FEE");
  }
  if (viaConnect && actualFeeCents != null && actualFeeCents < authorizedFeeCents) {
    flags.push("UNDER_COLLECTED_FEE");
  }
  if (p.disputed) flags.push("DISPUTED");
  if ((p.refundedCents || 0) > 0) flags.push("REFUNDED");

  // Money the platform actually retained from this payment.
  const retainedByPlatformCents = viaConnect ? (actualFeeCents || 0) : gross;
  // What the tenant should have ended up with (before Stripe processing fees,
  // which Stripe deducts from the platform on destination charges).
  const expectedTenantNetCents = Math.max(0, gross - authorizedFeeCents - (p.refundedCents || 0));
  const actualTransferredCents = viaConnect ? Math.max(0, gross - (actualFeeCents || 0)) : 0;
  // Remaining potentially owed to the tenant (remediation worksheet input).
  const remainingOwedToTenantCents = Math.max(0, expectedTenantNetCents - actualTransferredCents);

  return {
    flags,
    viaConnect,
    authorizedFeeCents,
    actualFeeCents,
    retainedByPlatformCents,
    expectedTenantNetCents,
    actualTransferredCents,
    remainingOwedToTenantCents,
    ok: flags.length === 0,
  };
}

// CSV helpers (no sensitive fields — ids and amounts only).
export function reconciliationCsv(rows) {
  const headers = [
    "paymentId", "created", "tenantId", "bookingId", "type", "grossCents", "currency",
    "destination", "expectedDestination", "viaConnect", "authorizedFeeCents", "actualFeeCents",
    "retainedByPlatformCents", "expectedTenantNetCents", "actualTransferredCents",
    "remainingOwedToTenantCents", "refundedCents", "disputed", "flags",
  ];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(h === "flags" ? (r.flags || []).join("|") : r[h])).join(",")),
  ].join("\n");
}
