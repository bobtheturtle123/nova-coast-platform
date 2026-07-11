import { describe, it, expect } from "vitest";
import {
  assessConnectAccount, verifyPiRouting, requireTenantPaymentAccount,
  PaymentSetupError, TENANT_PAYMENT_SETUP_INCOMPLETE,
  CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE,
} from "@/lib/connect";

const GOOD_ACCOUNT = {
  id: "acct_good",
  charges_enabled: true,
  payouts_enabled: true,
  capabilities: { card_payments: "active" },
  requirements: { disabled_reason: null, currently_due: [] },
};

describe("assessConnectAccount (fail-closed account checks)", () => {
  it("accepts a fully operational account", () => {
    expect(assessConnectAccount(GOOD_ACCOUNT)).toEqual({ ok: true, status: "connected", reason: null });
  });
  it("rejects a missing account", () => {
    expect(assessConnectAccount(null).ok).toBe(false);
  });
  it("rejects a deleted/disconnected account", () => {
    const r = assessConnectAccount({ ...GOOD_ACCOUNT, deleted: true });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("account_disconnected");
  });
  it("rejects charges_enabled=false", () => {
    const r = assessConnectAccount({ ...GOOD_ACCOUNT, charges_enabled: false });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("charges_disabled");
  });
  it("rejects payouts_enabled=false", () => {
    const r = assessConnectAccount({ ...GOOD_ACCOUNT, payouts_enabled: false });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("payouts_disabled");
  });
  it("rejects an inactive card_payments capability", () => {
    const r = assessConnectAccount({ ...GOOD_ACCOUNT, capabilities: { card_payments: "inactive" } });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("capability_inactive");
  });
  it("rejects accounts with a disabled_reason or outstanding requirements", () => {
    expect(assessConnectAccount({ ...GOOD_ACCOUNT, requirements: { disabled_reason: "requirements.past_due", currently_due: [] } }).status).toBe("restricted");
    expect(assessConnectAccount({ ...GOOD_ACCOUNT, requirements: { disabled_reason: null, currently_due: ["individual.id_number"] } }).status).toBe("information_required");
  });
});

describe("requireTenantPaymentAccount (fail-closed validation)", () => {
  const stripeWith = (account, fail = false) => ({
    accounts: { retrieve: async () => { if (fail) throw new Error("boom"); return account; } },
  });

  it("throws when the tenant has no stored connected account", async () => {
    await expect(requireTenantPaymentAccount({}, { stripeClient: stripeWith(GOOD_ACCOUNT) }))
      .rejects.toMatchObject({ code: TENANT_PAYMENT_SETUP_INCOMPLETE });
  });
  it("ignores client-shaped garbage account ids", async () => {
    await expect(requireTenantPaymentAccount({ stripeConnectAccountId: "not-an-account" }, { stripeClient: stripeWith(GOOD_ACCOUNT) }))
      .rejects.toBeInstanceOf(PaymentSetupError);
  });
  it("throws when charges are disabled", async () => {
    await expect(requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_charges_off" },
      { stripeClient: stripeWith({ ...GOOD_ACCOUNT, id: "acct_charges_off", charges_enabled: false }) }
    )).rejects.toMatchObject({ code: TENANT_PAYMENT_SETUP_INCOMPLETE });
  });
  it("throws when payouts are disabled", async () => {
    await expect(requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_payouts_off" },
      { stripeClient: stripeWith({ ...GOOD_ACCOUNT, id: "acct_payouts_off", payouts_enabled: false }) }
    )).rejects.toMatchObject({ code: TENANT_PAYMENT_SETUP_INCOMPLETE });
  });
  it("throws when the card capability is inactive", async () => {
    await expect(requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_cap_off" },
      { stripeClient: stripeWith({ ...GOOD_ACCOUNT, id: "acct_cap_off", capabilities: { card_payments: "pending" } }) }
    )).rejects.toBeInstanceOf(PaymentSetupError);
  });
  it("throws when the account is deleted", async () => {
    await expect(requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_deleted" },
      { stripeClient: stripeWith({ id: "acct_deleted", deleted: true }) }
    )).rejects.toBeInstanceOf(PaymentSetupError);
  });
  it("a Stripe retrieval failure does NOT fall back — it throws", async () => {
    await expect(requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_unreachable" },
      { stripeClient: stripeWith(null, true) }
    )).rejects.toBeInstanceOf(PaymentSetupError);
  });
  it("returns the verified account id for an operational account", async () => {
    const id = await requireTenantPaymentAccount(
      { stripeConnectAccountId: "acct_ok_1" },
      { stripeClient: stripeWith({ ...GOOD_ACCOUNT, id: "acct_ok_1" }) }
    );
    expect(id).toBe("acct_ok_1");
  });
  it("the customer-safe message never mentions Stripe internals", () => {
    expect(CUSTOMER_PAYMENT_UNAVAILABLE_MESSAGE).not.toMatch(/stripe|acct_|compliance/i);
  });
});

describe("verifyPiRouting (post-create + webhook gate)", () => {
  const pi = (over = {}) => ({
    transfer_data: { destination: "acct_tenant" },
    application_fee_amount: 200,
    ...over,
  });

  it("accepts a correctly routed destination charge", () => {
    expect(verifyPiRouting(pi(), "acct_tenant", 200).ok).toBe(true);
  });
  it("flags a platform-only charge (no destination)", () => {
    const r = verifyPiRouting(pi({ transfer_data: null }), "acct_tenant");
    expect(r.ok).toBe(false);
    expect(r.mismatches.join()).toMatch(/platform-only/);
  });
  it("flags the wrong destination", () => {
    const r = verifyPiRouting(pi(), "acct_other");
    expect(r.ok).toBe(false);
    expect(r.mismatches.join()).toMatch(/does not match/);
  });
  it("flags an application fee that differs from the canonical fee", () => {
    const r = verifyPiRouting(pi({ application_fee_amount: 999 }), "acct_tenant", 200);
    expect(r.ok).toBe(false);
    expect(r.mismatches.join()).toMatch(/fee/);
  });
  it("a null PI is a routing failure, never a pass", () => {
    expect(verifyPiRouting(null, "acct_tenant").ok).toBe(false);
  });
});
