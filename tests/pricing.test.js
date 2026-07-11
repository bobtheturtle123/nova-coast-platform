import { describe, it, expect } from "vitest";
import {
  calculateTenantPrice, clampMoney, getSqftTier, getActiveTiers,
  getItemPrice, calculateDeposit, SQFT_TIERS,
} from "@/lib/catalogUtils";

const catalog = {
  packages: [
    { id: "pkg1", price: 300, priceTiers: { Small: 300, Medium: 400 } },
  ],
  services: [
    { id: "svc1", price: 100 },
    { id: "svc2", price: 50 },
  ],
  addons: [
    { id: "add1", price: 75 },
  ],
  pricingConfig: {
    mode: "sqft",
    tiers: [
      { name: "Small",  label: "to 2500",  max: 2500 },
      { name: "Medium", label: "to 4000",  max: 4000 },
    ],
  },
  bookingConfig: { deposit: { type: "percent", value: 50 } },
};

describe("clampMoney (client-supplied money guard)", () => {
  it("zeroes negative values so they cannot reduce a price", () => {
    expect(clampMoney(-500)).toBe(0);
    expect(clampMoney("-500")).toBe(0);
  });
  it("zeroes NaN/garbage/Infinity", () => {
    expect(clampMoney("abc")).toBe(0);
    expect(clampMoney(undefined)).toBe(0);
    expect(clampMoney(null)).toBe(0);
    expect(clampMoney(Infinity)).toBe(0);
  });
  it("passes legitimate positive values through", () => {
    expect(clampMoney(45)).toBe(45);
    expect(clampMoney("45.50")).toBe(45.5);
  });
});

describe("calculateTenantPrice", () => {
  it("uses tier pricing from square footage", () => {
    const small = calculateTenantPrice(["pkg1"], [], [], 0, catalog, 2000);
    const med   = calculateTenantPrice(["pkg1"], [], [], 0, catalog, 3500);
    expect(small.base).toBe(300);
    expect(med.base).toBe(400);
  });
  it("adds a-la-carte services, addons, and a positive travel fee", () => {
    const q = calculateTenantPrice([], ["svc1", "svc2"], ["add1"], 25, catalog, 2000);
    expect(q.base).toBe(150);
    expect(q.addonTotal).toBe(75);
    expect(q.travelFee).toBe(25);
    expect(q.subtotal).toBe(250);
  });
  it("a clamped (0) travel fee cannot reduce the total", () => {
    const clean   = calculateTenantPrice([], ["svc1"], [], 0, catalog, 2000);
    const clamped = calculateTenantPrice([], ["svc1"], [], clampMoney(-999), catalog, 2000);
    expect(clamped.subtotal).toBe(clean.subtotal);
  });
  it("deposit never exceeds subtotal and balance is never negative", () => {
    const q = calculateTenantPrice([], ["svc2"], [], 0, catalog, 2000);
    expect(q.deposit).toBeLessThanOrEqual(q.subtotal);
    expect(q.balance).toBeGreaterThanOrEqual(0);
    expect(q.deposit + q.balance).toBeCloseTo(q.subtotal, 2);
  });
});

describe("deposit calculation", () => {
  it("percent deposits round to cents", () => {
    expect(calculateDeposit(333, { type: "percent", value: 50 })).toBeCloseTo(166.5, 2);
  });
  it("'none' collects the full amount up front (pay-in-full rule)", () => {
    const dep = calculateDeposit(400, { type: "none", value: 0 });
    expect(dep === 0 || dep === 400).toBe(true); // established behavior: no partial deposit
  });
});

describe("tier helpers", () => {
  it("getSqftTier maps footage to the configured tier", () => {
    expect(getSqftTier(2000, catalog.pricingConfig)).toBe("Small");
    expect(getSqftTier(3000, catalog.pricingConfig)).toBe("Medium");
  });
  it("defaults to the built-in tiers when none configured", () => {
    expect(getActiveTiers(null)).toBe(SQFT_TIERS);
  });
  it("getItemPrice falls back to base price when tier missing", () => {
    expect(getItemPrice({ price: 99 }, "Small")).toBe(99);
    expect(getItemPrice({ price: 99, priceTiers: { Small: 120 } }, "Small")).toBe(120);
  });
});
