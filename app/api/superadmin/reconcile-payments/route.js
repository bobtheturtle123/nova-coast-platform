import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { isSuperAdminVerified } from "@/lib/superadmin";
import { getEffectivePlan } from "@/lib/plans";
import { classifyPayment, reconciliationCsv } from "@/lib/reconcile";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// READ-ONLY historical payment reconciliation.
//
// Walks every tenant-client PaymentIntent in Stripe (metadata.tenantId +
// type deposit/full/balance), compares actual routing/fees against the
// canonical business rule, and returns a summary + per-discrepancy rows and a
// remediation worksheet. It never refunds, transfers, emails, or mutates
// ANYTHING — evidence for supervised remediation only.
//
// GET /api/superadmin/reconcile-payments            → JSON report
// GET /api/superadmin/reconcile-payments?format=csv → discrepancy CSV
// Optional: &max=5000 (PI scan cap), &since=<unix seconds>
export async function GET(req) {
  const auth = req.headers.get("Authorization");
  const secretOk = process.env.ADMIN_SECRET && auth === `Bearer ${process.env.ADMIN_SECRET}`;
  if (!secretOk && !(await isSuperAdminVerified(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url    = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const maxPis = Math.min(Number(url.searchParams.get("max")) || 5000, 20000);
  const since  = Number(url.searchParams.get("since")) || undefined;

  const TENANT_PAYMENT_TYPES = new Set(["deposit", "full", "balance"]);
  const tenantCache = new Map();
  async function getTenant(tenantId) {
    if (!tenantCache.has(tenantId)) {
      const doc = await adminDb.collection("tenants").doc(tenantId).get();
      tenantCache.set(tenantId, doc.exists ? doc.data() : null);
    }
    return tenantCache.get(tenantId);
  }

  const rows = [];
  const summary = {
    reviewed: 0,
    totalGrossCents: 0,
    totalAuthorizedFeesCents: 0,
    totalRetainedByPlatformCents: 0,
    totalExpectedTenantCents: 0,
    totalTransferredCents: 0,
    totalPotentiallyMisroutedCents: 0,
    viaConnectFalse: 0,
    missingDestinations: 0,
    missingTransfers: 0,
    wrongDestinations: 0,
    excessFees: 0,
    affectedTenants: new Set(),
    affectedClients: new Set(),
    affectedBookings: new Set(),
    earliest: null,
    latest: null,
    duplicateCandidates: 0,
  };
  const seenChargeKeys = new Map(); // bookingId+type+amount → count (duplicate-charge candidates)

  let scanned = 0, startingAfter;
  try {
    while (scanned < maxPis) {
      const page = await stripe.paymentIntents.list({
        limit: 100,
        ...(since ? { created: { gte: since } } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ["data.latest_charge"],
      });
      if (!page.data.length) break;

      for (const pi of page.data) {
        scanned++;
        const meta = pi.metadata || {};
        if (pi.status !== "succeeded") continue;
        if (!meta.tenantId || !TENANT_PAYMENT_TYPES.has(meta.type)) continue; // platform revenue / unrelated

        const tenant  = await getTenant(meta.tenantId);
        const charge  = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
        const record  = {
          piId:        pi.id,
          created:     new Date(pi.created * 1000).toISOString(),
          tenantId:    meta.tenantId,
          bookingId:   meta.bookingId || null,
          type:        meta.type,
          grossCents:  pi.amount_received ?? pi.amount ?? 0,
          currency:    pi.currency || "usd",
          destination: pi.transfer_data?.destination || null,
          applicationFeeCents: pi.application_fee_amount ?? null,
          refundedCents: charge?.amount_refunded || 0,
          disputed:     !!charge?.disputed,
        };

        const expectations = {
          expectedDestination: tenant?.stripeConnectAccountId || null,
          // NOTE: uses the tenant's CURRENT effective plan — historical plan
          // at charge time isn't stored; PI metadata.plan is used when present.
          planId: meta.plan || (tenant ? getEffectivePlan(tenant) : "solo"),
        };
        const result = classifyPayment(record, expectations);

        // Duplicate-charge candidates: same booking + type + amount succeeded twice.
        const dupKey = `${record.bookingId}_${record.type}_${record.grossCents}`;
        const dupCount = (seenChargeKeys.get(dupKey) || 0) + 1;
        seenChargeKeys.set(dupKey, dupCount);
        if (record.bookingId && dupCount > 1) result.flags.push("DUPLICATE_CHARGE_CANDIDATE");

        summary.reviewed++;
        summary.totalGrossCents             += record.grossCents;
        summary.totalAuthorizedFeesCents    += result.authorizedFeeCents;
        summary.totalRetainedByPlatformCents += result.retainedByPlatformCents;
        summary.totalExpectedTenantCents    += result.expectedTenantNetCents;
        summary.totalTransferredCents       += result.actualTransferredCents;
        if (!summary.earliest || record.created < summary.earliest) summary.earliest = record.created;
        if (!summary.latest   || record.created > summary.latest)   summary.latest   = record.created;

        if (!result.viaConnect) { summary.viaConnectFalse++; summary.missingDestinations++; }
        if (result.flags.includes("MISSING_TRANSFER"))  summary.missingTransfers++;
        if (result.flags.includes("WRONG_DESTINATION")) summary.wrongDestinations++;
        if (result.flags.includes("EXCESS_PLATFORM_FEE")) summary.excessFees++;
        if (result.flags.includes("DUPLICATE_CHARGE_CANDIDATE")) summary.duplicateCandidates++;

        if (result.flags.length > 0) {
          summary.totalPotentiallyMisroutedCents += result.remainingOwedToTenantCents;
          summary.affectedTenants.add(record.tenantId);
          if (record.bookingId) summary.affectedBookings.add(record.bookingId);
          if (pi.receipt_email) summary.affectedClients.add(pi.receipt_email);
          rows.push({
            ...record,
            expectedDestination: expectations.expectedDestination,
            ...result,
            // Remediation worksheet fields (calculated, NOT executed):
            worksheet: {
              amountChargedCents:      record.grossCents,
              authorizedFeeCents:      result.authorizedFeeCents,
              refundedCents:           record.refundedCents,
              alreadyTransferredCents: result.actualTransferredCents,
              remainingOwedToTenantCents: result.remainingOwedToTenantCents,
              note: "Verify Stripe processing fees + any manual payouts already made before transferring.",
            },
          });
        }
      }

      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  } catch (e) {
    return Response.json({ error: `Stripe scan failed: ${e?.message}`, scanned }, { status: 502 });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true, // this endpoint never moves money
    scannedPaymentIntents: scanned,
    ...summary,
    affectedTenants:  summary.affectedTenants.size,
    affectedClients:  summary.affectedClients.size,
    affectedBookings: summary.affectedBookings.size,
    discrepancies: rows,
  };

  if (format === "csv") {
    return new Response(reconciliationCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kyoria-payment-reconciliation-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return Response.json(report);
}
