// Outbound Zapier (and generic) webhooks. The tenant adds one or more "Catch
// Hook" URLs in Settings → Zapier; we POST a JSON payload when key booking
// events happen. Fire-and-forget — never block the main flow on a webhook.
//
// event: "booking.created" | "booking.paid" | "booking.delivered"
export async function dispatchZapier(tenant, event, data) {
  try {
    const hooks = tenant?.integrations?.zapierWebhooks;
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const payload = JSON.stringify({
      event,
      tenant: { id: tenant.id, businessName: tenant.businessName || tenant.branding?.businessName || "" },
      occurredAt: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(
      hooks
        .filter((u) => typeof u === "string" && u.startsWith("http"))
        .map((url) =>
          fetch(url, {
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
