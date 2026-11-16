import { describe, it, expect } from "vitest";
import { bookingWebhookData } from "../lib/zapier.js";

describe("bookingWebhookData attribution fields", () => {
  it("computes netTotal from stored pre-discount totalPrice minus promo", () => {
    const d = bookingWebhookData({ id: "b1", totalPrice: 500, promoCode: "WELCOME250", promoDiscount: 250, source: "manual", serviceIds: ["s1"] });
    expect(d.bookingId).toBe("b1");
    expect(d.promoCode).toBe("WELCOME250");
    expect(d.subtotal).toBe(500);
    expect(d.netTotal).toBe(250);
    expect(d.source).toBe("manual");
    expect(d.serviceIds).toEqual(["s1"]);
  });
  it("prefers explicit subtotal/netTotal and never goes negative", () => {
    expect(bookingWebhookData({ id: "b2", totalPrice: 100, subtotal: 400, netTotal: 100 }).netTotal).toBe(100);
    expect(bookingWebhookData({ id: "b3", totalPrice: 100, promoDiscount: 250 }).netTotal).toBe(0);
  });
  it("keeps legacy fields and defaults for bookings without promo", () => {
    const d = bookingWebhookData({ id: "b4", totalPrice: 300, packageId: "p1" });
    expect(d.promoCode).toBeNull();
    expect(d.netTotal).toBe(300);
    expect(d.packageIds).toEqual(["p1"]);
    expect(d.totalPrice).toBe(300);
  });
});
