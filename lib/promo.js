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

// ── Client-history restrictions ────────────────────────────────────────────
// `firstTimeOnly`  — the email must have NO prior (non-cancelled) booking.
// `returningOnly`  — the email must have AT LEAST ONE prior (non-cancelled)
//                    booking (e.g. a thank-you credit for existing clients).
// Both are enforced server-side when the booking is created. The public
// review step validates before the client has entered an email, so there
// the check is deferred (ok + pending) rather than skipped.
const DEAD_STATUSES = new Set(["cancelled", "canceled", "declined", "deleted"]);

export function clientEligibility(promo, priorBookings) {
  if (!promo?.firstTimeOnly && !promo?.returningOnly) return { ok: true };
  if (priorBookings == null) return { ok: true, pending: true };
  const prior = priorBookings.filter((b) => !DEAD_STATUSES.has(String(b?.status || "").toLowerCase()));
  if (promo.firstTimeOnly && prior.length > 0) {
    return { ok: false, error: "This code is valid for first-time clients only" };
  }
  if (promo.returningOnly && prior.length === 0) {
    return { ok: false, error: "This code is reserved for existing clients" };
  }
  return { ok: true };
}

// Prior bookings for an email under a tenant. Emails are stored as typed, so
// match both the raw and lower-cased form. Returns null when no email given.
export async function loadPriorBookings(tenantRef, email) {
  const raw = String(email || "").trim();
  if (!raw) return null;
  const forms = [...new Set([raw, raw.toLowerCase()])];
  const snap = await tenantRef.collection("bookings").where("clientEmail", "in", forms).limit(25).get();
  return snap.docs.map((d) => ({ id: d.id, status: d.data().status }));
}
