import { describe, it, expect } from "vitest";
import { classifyPayment, reconciliationCsv } from "@/lib/reconcile";

const base = {
  piId: "pi_1", tenantId: "t1", bookingId: "b1", type: "balance",
  grossCents: 100000, currency: "usd",
  destination: "acct_tenant", applicationFeeCents: 2000,
  refundedCents: 0, disputed: false,
};

describe("historical reconciliation classification", () => {
  it("accepts a correctly routed destination charge (solo 2%)", () => {
    const r = classifyPayment(base, { expectedDestination: "acct_tenant", planId: "solo" });
    expect(r.ok).toBe(true);
    expect(r.flags).toEqual([]);
    expect(r.viaConnect).toBe(true);
    expect(r.authorizedFeeCents).toBe(2000);
    expect(r.actualTransferredCents).toBe(98000);
    expect(r.remainingOwedToTenantCents).toBe(0);
  });

  it("flags a platform-only payment (viaConnect false) with a missing transfer", () => {
    const r = classifyPayment({ ...base, destination: null, applicationFeeCents: null },
      { expectedDestination: "acct_tenant", planId: "solo" });
    expect(r.flags).toContain("PLATFORM_ONLY_PAYMENT");
    expect(r.flags).toContain("MISSING_TRANSFER");
    expect(r.viaConnect).toBe(false);
    // Platform retained everything; tenant is owed gross minus the authorized fee.
    expect(r.retainedByPlatformCents).toBe(100000);
    expect(r.remainingOwedToTenantCents).toBe(98000);
  });

  it("flags an excessive platform fee (charged 2% on a Scale tenant)", () => {
    const r = classifyPayment({ ...base, applicationFeeCents: 2000 },
      { expectedDestination: "acct_tenant", planId: "scale" });
    expect(r.authorizedFeeCents).toBe(1250);
    expect(r.flags).toContain("EXCESS_PLATFORM_FEE");
    expect(r.remainingOwedToTenantCents).toBe(750); // over-retained amount owed back
  });

  it("flags the wrong destination account", () => {
    const r = classifyPayment({ ...base, destination: "acct_other" },
      { expectedDestination: "acct_tenant", planId: "solo" });
    expect(r.flags).toContain("WRONG_DESTINATION");
  });

  it("accounts for refunds in what the tenant is owed", () => {
    const r = classifyPayment({ ...base, destination: null, applicationFeeCents: null, refundedCents: 50000 },
      { expectedDestination: "acct_tenant", planId: "solo" });
    expect(r.flags).toContain("REFUNDED");
    expect(r.expectedTenantNetCents).toBe(48000); // 1000.00 - 20.00 fee - 500.00 refunded
  });

  it("marks disputes for manual review", () => {
    const r = classifyPayment({ ...base, disputed: true },
      { expectedDestination: "acct_tenant", planId: "solo" });
    expect(r.flags).toContain("DISPUTED");
  });
});

describe("reconciliation CSV", () => {
  it("emits headers + escaped rows without sensitive fields", () => {
    const csv = reconciliationCsv([{
      paymentId: "pi_1", created: "2026-01-01T00:00:00Z", tenantId: "t1", bookingId: "b,1",
      type: "balance", grossCents: 100, currency: "usd", destination: null,
      expectedDestination: "acct_t", viaConnect: false, authorizedFeeCents: 150,
      actualFeeCents: null, retainedByPlatformCents: 100, expectedTenantNetCents: 0,
      actualTransferredCents: 0, remainingOwedToTenantCents: 0, refundedCents: 0,
      disputed: false, flags: ["PLATFORM_ONLY_PAYMENT", "MISSING_TRANSFER"],
    }]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("paymentId");
    expect(lines[1]).toContain('"b,1"');                       // CSV escaping
    expect(lines[1]).toContain("PLATFORM_ONLY_PAYMENT|MISSING_TRANSFER");
    expect(csv.toLowerCase()).not.toMatch(/secret|card|cvc/);  // no sensitive data
  });
});
