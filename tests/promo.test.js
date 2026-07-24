import { describe, it, expect } from "vitest";
import { computePromoDiscount, validatePromo } from "@/lib/promo";

describe("computePromoDiscount", () => {
  it("computes a percent discount rounded to cents", () => {
    expect(computePromoDiscount({ type: "percent", value: 15 }, 200)).toBe(30);
    expect(computePromoDiscount({ type: "percent", value: 10 }, 99.99)).toBe(10);
  });

  it("computes a flat discount, capped at the subtotal", () => {
    expect(computePromoDiscount({ type: "flat", value: 50 }, 200)).toBe(50);
    expect(computePromoDiscount({ type: "flat", value: 300 }, 200)).toBe(200);
  });

  it("never exceeds the subtotal for a >100% percent code", () => {
    expect(computePromoDiscount({ type: "percent", value: 150 }, 200)).toBe(200);
  });
});

describe("validatePromo", () => {
  const base = { active: true, type: "percent", value: 10, usageCount: 0 };

  it("accepts a valid active code", () => {
    expect(validatePromo(base, 100)).toEqual({ ok: true, discount: 10 });
  });

  it("rejects a missing or inactive code", () => {
    expect(validatePromo(null, 100).ok).toBe(false);
    expect(validatePromo({ ...base, active: false }, 100).ok).toBe(false);
  });

  it("rejects an expired code and treats unparseable dates as expired", () => {
    expect(validatePromo({ ...base, expiresAt: "2020-01-01" }, 100).ok).toBe(false);
    expect(validatePromo({ ...base, expiresAt: "not-a-date" }, 100).ok).toBe(false);
    expect(validatePromo({ ...base, expiresAt: "2999-01-01" }, 100).ok).toBe(true);
  });

  it("rejects when the usage limit is reached", () => {
    expect(validatePromo({ ...base, usageLimit: 5, usageCount: 5 }, 100).ok).toBe(false);
    expect(validatePromo({ ...base, usageLimit: 5, usageCount: 4 }, 100).ok).toBe(true);
  });

  it("enforces a minimum order", () => {
    expect(validatePromo({ ...base, minOrder: 150 }, 100).ok).toBe(false);
    expect(validatePromo({ ...base, minOrder: 150 }, 200).ok).toBe(true);
  });
});

// Mirrors the apply-promo endpoint's balance math: applying a code reduces the
// remaining balance, replacing a code restores the prior discount first (so it
// stays idempotent), and removing a code adds the discount back.
describe("apply-promo balance adjustment", () => {
  const apply = (remaining, priorDiscount, newDiscount) => {
    const basis = Math.max(0, remaining + priorDiscount);
    return Math.max(0, basis - newDiscount);
  };
  const remove = (remaining, priorDiscount) => Math.max(0, remaining + priorDiscount);

  it("reduces the balance by the discount on first apply", () => {
    expect(apply(200, 0, 30)).toBe(170);
  });

  it("is idempotent when replacing an existing code", () => {
    // 200 → apply 10% (−20) → 180 → replace with 25% (−50) → 150, not 130
    const after10 = apply(200, 0, 20);
    expect(after10).toBe(180);
    expect(apply(after10, 20, 50)).toBe(150);
  });

  it("never drops below zero", () => {
    expect(apply(100, 0, 250)).toBe(0);
  });

  it("restores the discount on remove", () => {
    expect(remove(170, 30)).toBe(200);
  });
});
