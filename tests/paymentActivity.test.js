import { describe, it, expect } from "vitest";
import { buildPaymentEntry, paymentActivityKey } from "@/lib/paymentActivity";

describe("idempotency keys", () => {
  it("is deterministic per PaymentIntent — webhook retry + verify fallback share one key", () => {
    const a = paymentActivityKey({ paymentType: "deposit", piId: "pi_123" });
    const b = paymentActivityKey({ paymentType: "deposit", piId: "pi_123", sessionId: "cs_999" });
    expect(a).toBe("pay_pi_123");
    expect(b).toBe("pay_pi_123"); // PI id wins → same doc, no duplicate entry
  });
  it("falls back to the session id when no PI is known", () => {
    expect(paymentActivityKey({ paymentType: "balance", sessionId: "cs_1" })).toBe("pay_cs_1");
  });
  it("refunds key on the charge (cumulative partial refunds update one entry)", () => {
    expect(paymentActivityKey({ paymentType: "refund", chargeId: "ch_9" })).toBe("refund_ch_9");
  });
  it("failed payments key on the PI", () => {
    expect(paymentActivityKey({ paymentType: "failed", piId: "pi_5" })).toBe("payfail_pi_5");
  });
  it("honors an explicit idKey (manual payments)", () => {
    expect(paymentActivityKey({ paymentType: "manual", idKey: "manual_b1_4500" })).toBe("manual_b1_4500");
  });
});

describe("buildPaymentEntry — wording", () => {
  it("deposit: '<payer> paid a $X booking deposit.'", () => {
    const { doc } = buildPaymentEntry({ paymentType: "deposit", payerName: "Maria Lopez", grossCents: 45000, piId: "pi_1" });
    expect(doc.title).toBe("Maria Lopez paid a $450.00 booking deposit.");
  });
  it("balance: '<payer> paid the remaining balance of $X.'", () => {
    const { doc } = buildPaymentEntry({ paymentType: "balance", payerName: "John Smith", grossCents: 27500, piId: "pi_2" });
    expect(doc.title).toBe("John Smith paid the remaining balance of $275.00.");
  });
  it("full: 'A full payment of $X was received from <payer>.'", () => {
    const { doc } = buildPaymentEntry({ paymentType: "full", payerName: "Alex Brown", grossCents: 125000, piId: "pi_3" });
    expect(doc.title).toBe("A full payment of $1,250.00 was received from Alex Brown.");
  });
  it("refund: 'A $X refund was issued to <payer>.'", () => {
    const { doc } = buildPaymentEntry({ paymentType: "refund", payerName: "Maria Lopez", grossCents: 10000, chargeId: "ch_1", status: "refunded" });
    expect(doc.title).toBe("A $100.00 refund was issued to Maria Lopez.");
    expect(doc.type).toBe("refund");
  });
  it("falls back to email, then 'The client'", () => {
    expect(buildPaymentEntry({ paymentType: "deposit", payerEmail: "a@b.com", grossCents: 100, piId: "x" }).doc.title)
      .toContain("a@b.com");
    expect(buildPaymentEntry({ paymentType: "deposit", grossCents: 100, piId: "x" }).doc.title)
      .toContain("The client");
  });
});

describe("buildPaymentEntry — money math + metadata", () => {
  it("net = gross - platform fee, and the breakdown appears in the details", () => {
    const { doc } = buildPaymentEntry({
      paymentType: "full", payerName: "Alex", grossCents: 125000, feeCents: 1875, piId: "pi_9",
      connectedAccountId: "acct_1", sessionId: "cs_9", chargeId: "ch_9",
    });
    expect(doc.netCents).toBe(123125);
    expect(doc.message).toContain("Platform fee: $18.75");
    expect(doc.message).toContain("Net to you");
    expect(doc.viaConnect).toBe(true);
  });
  it("unknown fee stays null (never fabricated) and net is omitted", () => {
    const { doc } = buildPaymentEntry({ paymentType: "deposit", grossCents: 5000, piId: "pi_n" });
    expect(doc.feeCents).toBe(null);
    expect(doc.netCents).toBe(null);
    expect(doc.message).not.toContain("Platform fee");
  });
  it("tip line included only when a tip exists", () => {
    const withTip = buildPaymentEntry({ paymentType: "deposit", grossCents: 10000, tipCents: 1000, piId: "a" }).doc;
    const noTip   = buildPaymentEntry({ paymentType: "balance", grossCents: 10000, piId: "b" }).doc;
    expect(withTip.message).toContain("Includes tip: $10.00");
    expect(noTip.message).not.toContain("tip");
  });
  it("stores integer cents and lowercase currency", () => {
    const { doc } = buildPaymentEntry({ paymentType: "deposit", grossCents: 100.7, currency: "USD", piId: "c" });
    expect(Number.isInteger(doc.grossCents)).toBe(true);
    expect(doc.currency).toBe("usd");
  });
});

describe("buildPaymentEntry — safety", () => {
  it("contains no undefined values (Firestore merge-safe)", () => {
    const { doc } = buildPaymentEntry({ paymentType: "deposit", grossCents: 100, piId: "pi_u" });
    for (const v of Object.values(doc)) expect(v).not.toBe(undefined);
  });
  it("never includes sensitive card fields", () => {
    const { doc } = buildPaymentEntry({ paymentType: "deposit", grossCents: 100, piId: "pi_s", method: "card" });
    const keys = Object.keys(doc).join(" ").toLowerCase();
    expect(keys).not.toMatch(/cvc|card_number|cardnumber|pan|account_number/);
    expect(doc.method).toBe("card"); // category only
  });
  it("failed payments map to the payment_failed type with failed status", () => {
    const { doc } = buildPaymentEntry({ paymentType: "failed", grossCents: 100, piId: "pi_f", status: "failed" });
    expect(doc.type).toBe("payment_failed");
    expect(doc.status).toBe("failed");
  });
});
