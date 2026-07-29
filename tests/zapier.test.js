import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchZapier, bookingWebhookData } from "@/lib/zapier";

describe("bookingWebhookData", () => {
  it("includes client name, email, brokerage and gallery link for a feedback Zap", () => {
    const d = bookingWebhookData({
      id: "b1", clientName: "Jane Agent", clientEmail: "jane@brk.com",
      clientCompany: "Coldwell Banker", fullAddress: "123 Main St",
      galleryLink: "https://kyoriaos.com/acme/gallery/tok",
    });
    expect(d.clientName).toBe("Jane Agent");
    expect(d.clientEmail).toBe("jane@brk.com");
    expect(d.clientCompany).toBe("Coldwell Banker");
    expect(d.galleryLink).toBe("https://kyoriaos.com/acme/gallery/tok");
  });
});

const tenant = (hooks) => ({ id: "t1", businessName: "Biz", integrations: { zapierWebhooks: hooks } });

describe("dispatchZapier — per-event routing", () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.resolve({ ok: true })); });

  it("calls only the hook subscribed to the fired event", async () => {
    await dispatchZapier(tenant([
      { url: "https://hooks.zapier.com/deliver", event: "delivered" },
      { url: "https://hooks.zapier.com/create",  event: "created" },
    ]), "booking.delivered", {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("https://hooks.zapier.com/deliver", expect.anything());
  });

  it("legacy plain-string hooks receive every event", async () => {
    await dispatchZapier(tenant(["https://hooks.zapier.com/legacy"]), "booking.paid", {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("an 'all' hook receives every event", async () => {
    await dispatchZapier(tenant([{ url: "https://hooks.zapier.com/all", event: "all" }]), "booking.created", {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not call a hook subscribed to a different event", async () => {
    await dispatchZapier(tenant([{ url: "https://hooks.zapier.com/create", event: "created" }]), "booking.delivered", {});
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
