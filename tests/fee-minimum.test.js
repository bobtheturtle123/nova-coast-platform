import { describe, it, expect } from "vitest";
import { calculatePlatformFee, MIN_PLATFORM_FEE_CENTS } from "@/lib/plans";

// Documents and locks in EXACTLY how the $1.50 minimum platform fee works.
// Rates: Solo/Studio 2%, Pro 1.5%, Scale 1.25%, exempt 0%. Integer cents,
// round-half-up, then Math.max(fee, $1.50) — EXCEPT fee-exempt (0 bps) plans
// which are never floored.
const MIN = 150; // cents

describe("the $1.50 minimum floor", () => {
  it("MIN_PLATFORM_FEE_CENTS is $1.50", () => {
    expect(MIN_PLATFORM_FEE_CENTS).toBe(MIN);
  });

  // Threshold = MIN / rate. Below it, the percentage is under $1.50 → floored.
  it("Solo/Studio (2%): fee floors to $1.50 below $75, then scales by 2%", () => {
    expect(calculatePlatformFee(1000, "solo")).toBe(MIN);   // $10 → 2% = $0.20 → $1.50
    expect(calculatePlatformFee(5000, "studio")).toBe(MIN);  // $50 → $1.00 → $1.50
    expect(calculatePlatformFee(7500, "solo")).toBe(MIN);    // $75 → exactly $1.50
    expect(calculatePlatformFee(10000, "solo")).toBe(200);   // $100 → $2.00 (above floor)
  });

  it("Pro (1.5%): floors below $100", () => {
    expect(calculatePlatformFee(5000, "pro")).toBe(MIN);     // $50 → $0.75 → $1.50
    expect(calculatePlatformFee(10000, "pro")).toBe(MIN);    // $100 → exactly $1.50
    expect(calculatePlatformFee(20000, "pro")).toBe(300);    // $200 → $3.00
  });

  it("Scale (1.25%): floors below $120", () => {
    expect(calculatePlatformFee(5000, "scale")).toBe(MIN);   // $50 → $0.625 → $1.50
    expect(calculatePlatformFee(12000, "scale")).toBe(MIN);  // $120 → exactly $1.50
    expect(calculatePlatformFee(40000, "scale")).toBe(500);  // $400 → $5.00
  });

  it("fee-exempt plans are 0 and are NEVER floored to $1.50", () => {
    expect(calculatePlatformFee(1000, "unlimited")).toBe(0);
    expect(calculatePlatformFee(100000, "unlimited")).toBe(0);
  });
});

describe("fee is computed on the CHARGED amount (partial / discounted / deposit)", () => {
  // The fee always applies to whatever amount is actually charged in that
  // PaymentIntent — deposit, remaining balance, discounted total, etc. — since
  // calculatePlatformFee takes the charge amount. These prove the arithmetic.
  it("a $300 deposit on Pro is charged 1.5% = $4.50", () => {
    expect(calculatePlatformFee(30000, "pro")).toBe(450);
  });
  it("a discounted $60 charge on Studio still floors to $1.50 (2% = $1.20)", () => {
    expect(calculatePlatformFee(6000, "studio")).toBe(MIN);
  });
  it("a tiny $10 balance on Scale floors to $1.50", () => {
    expect(calculatePlatformFee(1000, "scale")).toBe(MIN);
  });
});

describe("rounding is deterministic (round half up) and integer-cent", () => {
  it("rounds half up", () => {
    // $125.25 @ 2% = 250.5 → 251
    expect(calculatePlatformFee(12525, "solo")).toBe(251);
    // $333.33 @ 1.5% = 499.995 → 500
    expect(calculatePlatformFee(33333, "pro")).toBe(500);
  });
  it("always returns an integer number of cents", () => {
    for (const amt of [1, 99, 100, 12525, 33333, 999999]) {
      for (const plan of ["solo", "pro", "scale"]) {
        expect(Number.isInteger(calculatePlatformFee(amt, plan))).toBe(true);
      }
    }
  });
  it("garbage/negative amounts clamp to 0 then the floor rules apply", () => {
    expect(calculatePlatformFee(-5000, "solo")).toBe(MIN); // clamped to 0 → floored
    expect(calculatePlatformFee(NaN, "unlimited")).toBe(0); // exempt stays 0
  });
});
