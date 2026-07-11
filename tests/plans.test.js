import { describe, it, expect } from "vitest";
import {
  calculatePlatformFee, getEffectivePlan, getPlan, PLANS,
  MIN_PLATFORM_FEE_CENTS, getListingLimit, getSeatLimit,
} from "@/lib/plans";

describe("platform fee percentages (canonical rates)", () => {
  it("Solo charges exactly 2%", () => {
    expect(calculatePlatformFee(100000, "solo")).toBe(2000); // $1000 → $20.00
  });
  it("Studio charges exactly 2%", () => {
    expect(calculatePlatformFee(100000, "studio")).toBe(2000);
  });
  it("Pro charges exactly 1.5%", () => {
    expect(calculatePlatformFee(100000, "pro")).toBe(1500); // $1000 → $15.00
  });
  it("Scale charges exactly 1.25%", () => {
    expect(calculatePlatformFee(100000, "scale")).toBe(1250); // $1000 → $12.50
  });
  it("unknown/missing plans fall back to Solo (2%)", () => {
    expect(calculatePlatformFee(100000, "nonsense")).toBe(2000);
    expect(calculatePlatformFee(100000, undefined)).toBe(2000);
  });
});

describe("minimum fee floor ($1.50 — established rule in lib/plans)", () => {
  it("applies the floor to small charges on fee-bearing plans", () => {
    // $10 at 2% = $0.20 → floored to $1.50
    expect(calculatePlatformFee(1000, "solo")).toBe(MIN_PLATFORM_FEE_CENTS);
    // $50 at 1.25% = $0.625 → floored
    expect(calculatePlatformFee(5000, "scale")).toBe(MIN_PLATFORM_FEE_CENTS);
  });
  it("does NOT resurrect a fee for fee-exempt (0 bps) plans", () => {
    expect(PLANS.unlimited.transactionFeeBps).toBe(0);
    expect(calculatePlatformFee(100000, "unlimited")).toBe(0);
    expect(calculatePlatformFee(1000, "unlimited")).toBe(0);
  });
});

describe("integer-cent handling and deterministic rounding", () => {
  it("returns integer cents", () => {
    const fee = calculatePlatformFee(33333, "pro"); // 499.995 → 500
    expect(Number.isInteger(fee)).toBe(true);
    expect(fee).toBe(500);
  });
  it("rounds half up consistently", () => {
    expect(calculatePlatformFee(12525, "solo")).toBe(Math.max(251, MIN_PLATFORM_FEE_CENTS)); // 250.5 → 251
  });
  it("clamps negative/garbage amounts to 0 (then floor rules apply)", () => {
    expect(calculatePlatformFee(-5000, "solo")).toBe(MIN_PLATFORM_FEE_CENTS);
    expect(calculatePlatformFee(NaN, "unlimited")).toBe(0);
  });
});

describe("effective plan resolution", () => {
  it("uses permanentPlan override before subscriptionPlan", () => {
    expect(getEffectivePlan({ permanentPlan: "scale", subscriptionPlan: "solo" })).toBe("scale");
  });
  it("falls back to subscriptionPlan, then solo", () => {
    expect(getEffectivePlan({ subscriptionPlan: "pro" })).toBe("pro");
    expect(getEffectivePlan({})).toBe("solo");
  });
  it("unlimited flag maps to the fee-exempt plan", () => {
    expect(getEffectivePlan({ unlimited: true })).toBe("unlimited");
    expect(calculatePlatformFee(100000, getEffectivePlan({ unlimited: true }))).toBe(0);
  });
  it("getPlan falls back to solo for unknown ids", () => {
    expect(getPlan("bogus").id).toBe("solo");
  });
});

describe("plan limits sanity", () => {
  it("listing limits include add-on credits", () => {
    expect(getListingLimit("solo", 25)).toBe(PLANS.solo.activeListings + 25);
  });
  it("scale add-on seats extend the base; unlimited seats stay null", () => {
    expect(getSeatLimit("studio", 2)).toBe(PLANS.studio.teamSeats + 2);
    expect(getSeatLimit("unlimited", 5)).toBe(null);
  });
});
