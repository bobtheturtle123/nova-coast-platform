// Discount math + validation for tenant promo codes, shared by the dashboard
// validate endpoint and the manual-booking create route so the two can never
// drift apart. Promo `type` is "flat" (dollars off) or "percent".

export function computePromoDiscount(promo, subtotal) {
  const sub = Number(subtotal) || 0;
  const value = Number(promo?.value) || 0;
  if (promo?.type === "flat") return Math.min(value, sub);
  // percent — round to cents, never more than the subtotal
  return Math.min(sub, Math.round((sub * value) / 100 * 100) / 100);
}

// Returns { ok: true, discount } or { ok: false, error }. Never throws.
// `now` is injectable for tests; expiry treats unparseable dates as expired.
export function validatePromo(promo, subtotal, { now = new Date() } = {}) {
  if (!promo) return { ok: false, error: "Promo code not found" };
  if (!promo.active) return { ok: false, error: "This promo code is inactive" };

  if (promo.expiresAt) {
    const e = new Date(promo.expiresAt?.toDate?.() || promo.expiresAt);
    if (isNaN(e) || e < now) return { ok: false, error: "This promo code has expired" };
  }
  if (promo.usageLimit > 0 && (promo.usageCount || 0) >= promo.usageLimit) {
    return { ok: false, error: "This promo code has reached its usage limit" };
  }
  const sub = Number(subtotal) || 0;
  if (promo.minOrder > 0 && sub < promo.minOrder) {
    return { ok: false, error: `This code requires a minimum order of $${promo.minOrder}` };
  }
  return { ok: true, discount: computePromoDiscount(promo, sub) };
}
