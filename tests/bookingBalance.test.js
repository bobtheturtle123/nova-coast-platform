import { describe, it, expect } from "vitest";
import { recomputeBalance } from "@/lib/bookingBalance";

describe("recomputeBalance", () => {
  it("re-derives the deposit only when nothing is paid yet", () => {
    const r = recomputeBalance({ newTotal: 1000, depositPaid: false, depositPct: 0.5 });
    expect(r.depositAmount).toBe(500);
    expect(r.remainingBalance).toBe(1000);
  });

  it("keeps a PAID deposit fixed and only moves the balance", () => {
    // Client paid a $500 deposit on a $1000 booking. Add $200 of custom items.
    const r = recomputeBalance({ newTotal: 1200, depositPaid: true, priorDeposit: 500 });
    expect(r.depositAmount).toBeUndefined();      // deposit is NOT recomputed
    expect(r.remainingBalance).toBe(700);          // 1200 − 500 already paid
  });

  it("does not re-charge the deposit when items are added back", () => {
    // The bug scenario: total dropped to 800, now restored to 1000.
    const r = recomputeBalance({ newTotal: 1000, depositPaid: true, priorDeposit: 500 });
    expect(r.remainingBalance).toBe(500);          // 1000 − 500, deposit untouched
  });

  it("accounts for a promo discount before subtracting the paid deposit", () => {
    const r = recomputeBalance({ newTotal: 1000, discount: 100, depositPaid: true, priorDeposit: 500 });
    expect(r.remainingBalance).toBe(400);          // (1000 − 100) − 500
  });

  it("owes nothing once fully paid, regardless of new total", () => {
    expect(recomputeBalance({ newTotal: 1500, balancePaid: true, priorDeposit: 500 }).remainingBalance).toBe(0);
    expect(recomputeBalance({ newTotal: 1500, paidInFull: true }).remainingBalance).toBe(0);
  });

  it("never goes negative when the paid deposit exceeds the new total", () => {
    const r = recomputeBalance({ newTotal: 300, depositPaid: true, priorDeposit: 500 });
    expect(r.remainingBalance).toBe(0);
  });
});
