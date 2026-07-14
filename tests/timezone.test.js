import { describe, it, expect } from "vitest";
import { resolveTenantTimezone, addMinutesToNaive } from "@/lib/timezone";

describe("resolveTenantTimezone", () => {
  it("uses the explicit tenant setting when present", () => {
    expect(resolveTenantTimezone({ timezone: "America/Los_Angeles" })).toBe("America/Los_Angeles");
  });
  it("reads bookingConfig.timezone as a secondary explicit source", () => {
    expect(resolveTenantTimezone({ bookingConfig: { timezone: "America/Denver" } })).toBe("America/Denver");
  });
  it("infers Pacific from west-coast coordinates (the reported bug)", () => {
    // San Diego ≈ -117.16 lng → must NOT default to Eastern
    expect(resolveTenantTimezone({ defaultCoords: { lat: 32.7, lng: -117.16 } })).toBe("America/Los_Angeles");
  });
  it("infers Central/Eastern from longitude", () => {
    expect(resolveTenantTimezone({ defaultCoords: { lng: -90 } })).toBe("America/Chicago");
    expect(resolveTenantTimezone({ defaultCoords: { lng: -80 } })).toBe("America/New_York");
  });
  it("infers from a US ZIP when there are no coordinates", () => {
    expect(resolveTenantTimezone({ fromZip: "92037" })).toBe("America/Los_Angeles"); // La Jolla, CA
    expect(resolveTenantTimezone({ fromZip: "97201" })).toBe("America/Los_Angeles"); // Portland, OR (not Hawaii)
    expect(resolveTenantTimezone({ fromZip: "96813" })).toBe("Pacific/Honolulu");    // Honolulu, HI
    expect(resolveTenantTimezone({ fromZip: "60601" })).toBe("America/Chicago");     // Chicago
  });
  it("falls back to Eastern only as a last resort", () => {
    expect(resolveTenantTimezone({})).toBe("America/New_York");
    expect(resolveTenantTimezone(null)).toBe("America/New_York");
  });
});

describe("addMinutesToNaive (server-timezone independent)", () => {
  it("adds a duration to a wall-clock time without shifting it", () => {
    expect(addMinutesToNaive("2026-07-15", 10, 0, 120)).toBe("2026-07-15T12:00:00");
  });
  it("rolls across midnight correctly", () => {
    expect(addMinutesToNaive("2026-07-15", 23, 30, 60)).toBe("2026-07-16T00:30:00");
  });
  it("handles odd durations and zero-padding", () => {
    expect(addMinutesToNaive("2026-01-05", 9, 5, 55)).toBe("2026-01-05T10:00:00");
  });
});
