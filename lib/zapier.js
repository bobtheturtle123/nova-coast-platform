// Outbound Zapier (and generic) webhooks. The tenant adds one or more "Catch
// Hook" URLs in Settings → Zapier; we POST a JSON payload when key booking
// events happen. Fire-and-forget — never block the main flow on a webhook.
//
// event: "booking.created" | "booking.paid" | "booking.delivered"
//
// A webhook can be a plain URL string (legacy — receives EVERY event) or an
// object { url, event } that subscribes to ONE event ("created" | "paid" |
// "delivered") or "all". Only hooks subscribed to this event are called, so a
// tenant can point (say) a delivery-feedback Zap at delivery events alone.
export async function dispatchZapier(tenant, event, data) {
  try {
    const raw = tenant?.integrations?.zapierWebhooks;
    if (!Array.isArray(raw) || raw.length === 0) return;

    const shortEvent = String(event || "").replace(/^booking\./, ""); // "delivered"
    const hooks = raw
      .map((h) => (typeof h === "string" ? { url: h, event: "all" } : h))
      .filter((h) => h && typeof h.url === "string" && h.url.startsWith("http"))
      .filter((h) => !h.event || h.event === "all" || h.event === shortEvent);
    if (hooks.length === 0) return;

    const payload = JSON.stringify({
      event,
      tenant: { id: tenant.id, businessName: tenant.businessName || tenant.branding?.businessName || "" },
      occurredAt: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(
      hooks.map((h) =>
        fetch(h.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        })
      )
    );
  } catch (e) {
    console.error("[zapier] dispatch failed:", e?.message || e);
  }
}

// Build a compact, stable booking payload for webhooks.
export function bookingWebhookData(b) {
  return {
    bookingId:        b.id,
    clientName:       b.clientName || "",
    clientEmail:      b.clientEmail || "",
    clientPhone:      b.clientPhone || "",
    address:          b.fullAddress || b.address || "",
    status:           b.status || "",
    totalPrice:       b.totalPrice ?? null,
    depositPaid:      !!b.depositPaid,
    paidInFull:       !!b.paidInFull,
    remainingBalance: b.remainingBalance ?? null,
    shootDate:        b.shootDate || b.preferredDate || null,
    shootTime:        b.shootTime || b.preferredTime || null,
    photographerName: b.photographerName || null,
  };
}
