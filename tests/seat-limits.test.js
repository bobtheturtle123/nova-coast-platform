import { describe, it, expect } from "vitest";
import { getSeatLimit, getEffectivePlan, PLANS } from "@/lib/plans";

// Backs the server-side seat-limit enforcement added to the staff-invite route
// (previously only the UI gated seat count, so a direct API call could exceed
// the plan). These lock in the seat math the enforcement relies on.

describe("plan seat limits", () => {
  it("each paid plan exposes a finite seat count; unlimited is null", () => {
    expect(getSeatLimit("solo")).toBe(1);
    expect(getSeatLimit("studio")).toBe(3);
    expect(getSeatLimit("pro")).toBe(5);
    expect(getSeatLimit("scale")).toBe(10);
    expect(getSeatLimit("unlimited")).toBe(null); // only fee-exempt/lifetime is unlimited
  });
  it("add-on seats extend the base limit", () => {
    expect(getSeatLimit("studio", 2)).toBe(5);
    expect(getSeatLimit("unlimited", 5)).toBe(null); // stays unlimited
  });
  it("unknown plan falls back to solo's limit (least seats), never unlimited", () => {
    expect(getSeatLimit("nonsense")).toBe(getSeatLimit("solo"));
    expect(getSeatLimit("nonsense")).not.toBe(null);
  });

  // The enforcement formula: seats used = active/invited members + owner (1);
  // block a new invite when used >= limit.
  function canInvite(memberCount, planId, addonSeats = 0) {
    const limit = getSeatLimit(planId, addonSeats);
    if (limit === null) return true;
    return (memberCount + 1) < limit;
  }
  it("blocks inviting past the plan limit but allows up to it", () => {
    // studio = 3 seats: owner + up to 2 members
    expect(canInvite(0, "studio")).toBe(true);  // owner only → can add
    expect(canInvite(1, "studio")).toBe(true);  // owner + 1 → can add
    expect(canInvite(2, "studio")).toBe(false); // owner + 2 = 3 used → blocked
    // solo = 1 seat: owner only, no invites
    expect(canInvite(0, "solo")).toBe(false);
    // unlimited: always allowed
    expect(canInvite(999, "unlimited")).toBe(true);
  });
  it("add-on seats raise the ceiling", () => {
    expect(canInvite(2, "studio", 2)).toBe(true);  // 3+2=5 seats, owner+2 → can add
    expect(canInvite(4, "studio", 2)).toBe(false); // owner+4 = 5 used → blocked
  });
});

describe("superadmin effective plan is unlimited (no seat cap)", () => {
  it("superadmin email resolves to unlimited", () => {
    expect(getSeatLimit(getEffectivePlan({ email: "complexdesign123@gmail.com" }))).toBe(null);
  });
  it("a normal tenant never resolves to unlimited by default", () => {
    expect(getSeatLimit(getEffectivePlan({ email: "someone@studio.com", subscriptionPlan: "studio" }))).toBe(3);
  });
});
