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

    // Callers await this so the request survives on serverless; each hook is
    // capped at 5s so a slow receiver can't hold the response. Log only the
    // host + status, never the full URL (it may carry a secret key).
    const results = await Promise.allSettled(
      hooks.map((h) =>
        fetch(h.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(5000),
        })
      )
    );
    const summary = results.map((r, i) => {
      let host = "?";
      try { host = new URL(hooks[i].url).host; } catch {}
      return `${host}=${r.status === "fulfilled" ? r.value.status : "err:" + (r.reason?.name || "fail")}`;
    });
    console.log(`[zapier] ${event} tenant=${tenant.id} hooks=${hooks.length} ${summary.join(" ")}`);
  } catch (e) {
    console.error("[zapier] dispatch failed:", e?.message || e);
  }
}

// Build a compact, stable booking payload for webhooks. Callers can spread extra
// fields onto `b` (e.g. galleryLink) and they'll be picked up below.
export function bookingWebhookData(b) {
  return {
    bookingId:        b.id,
    clientName:       b.clientName || "",
    clientEmail:      b.clientEmail || "",
    clientPhone:      b.clientPhone || "",
    clientCompany:    b.clientCompany || b.clientBrokerage || b.brokerage || "",
    address:          b.fullAddress || b.address || "",
    status:           b.status || "",
    totalPrice:       b.totalPrice ?? null,
    depositPaid:      !!b.depositPaid,
    paidInFull:       !!b.paidInFull,
    remainingBalance: b.remainingBalance ?? null,
    shootDate:        b.shootDate || b.preferredDate || null,
    shootTime:        b.shootTime || b.preferredTime || null,
    photographerName: b.photographerName || null,
    // Present on delivery events — the client's gallery URL (handy for a
    // post-delivery feedback email that links back to their photos).
    galleryLink:      b.galleryLink || null,
    // Attribution / reconciliation fields (additive — existing Zaps unaffected).
    // `source` is "online" (public booking page) or "manual" (dashboard/phone).
    // `netTotal` is the amount actually owed after promo/partner discounts —
    // use it (with bookingId as the dedupe key) for offline conversion value.
    source:           b.source || null,
    promoCode:        b.promoCode || null,
    promoDiscount:    Number(b.promoDiscount) || 0,
    partnerDiscount:  Number(b.partnerDiscount) || 0,
    subtotal:         b.subtotal ?? b.totalPrice ?? null,
    netTotal:         b.netTotal ?? (b.totalPrice != null
                        ? Math.max(0, Number(b.totalPrice) - (Number(b.promoDiscount) || 0) - (Number(b.partnerDiscount) || 0))
                        : null),
    packageIds:       Array.isArray(b.packageIds) ? b.packageIds : (b.packageId ? [b.packageId] : []),
    serviceIds:       Array.isArray(b.serviceIds) ? b.serviceIds : [],
    addonIds:         Array.isArray(b.addonIds) ? b.addonIds : [],
  };
}
