import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchZapier } from "@/lib/zapier";

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
