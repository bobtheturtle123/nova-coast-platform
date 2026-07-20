import { adminDb } from "@/lib/firebase-admin";

// Partner pricing: a standing discount for a partner relationship — e.g. a
// brokerage signs up and every agent on that customer team gets 15% off.
// Unlike a promo code there is nothing to type: it resolves from the booking
// email and applies automatically.
//
// A discount can live on either:
//   tenants/{t}/customerTeams/{id}.partnerDiscount  — whole team
//   tenants/{t}/agents/{agentId}.partnerDiscount    — one agent
// Shape: { active, percent, label }
//
// Team membership is by agentId, which is derived from the email, so a single
// lookup covers both cases.

export function agentIdForEmail(email) {
  return Buffer.from(String(email || "").toLowerCase())
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32);
}

function normalize(raw, source) {
  if (!raw?.active) return null;
  const percent = Number(raw.percent);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  return {
    percent: Math.min(100, percent),
    label:   raw.label || "Partner pricing",
    source,
  };
}

/**
 * Finds the partner discount that applies to a booking email, or null.
 *
 * Checks the agent's own record first (an individual override), then any
 * customer team they belong to. If several apply, the largest wins — a partner
 * should never be charged more because of how they were categorized.
 * Never throws: a lookup failure must not block a booking.
 */
export async function resolvePartnerDiscount(tenantId, email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!tenantId || !clean.includes("@")) return null;

  const agentId = agentIdForEmail(clean);
  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  const found = [];

  try {
    const [agentDoc, teamSnap] = await Promise.all([
      tenantRef.collection("agents").doc(agentId).get(),
      tenantRef.collection("customerTeams").where("members", "array-contains", agentId).limit(10).get(),
    ]);

    if (agentDoc.exists) {
      const d = normalize(agentDoc.data().partnerDiscount, {
        type: "agent",
        id:   agentDoc.id,
        name: agentDoc.data().company || agentDoc.data().name || null,
      });
      if (d) found.push(d);
    }

    for (const doc of teamSnap.docs) {
      const d = normalize(doc.data().partnerDiscount, {
        type: "team",
        id:   doc.id,
        name: doc.data().name || null,
      });
      if (d) found.push(d);
    }
  } catch (e) {
    console.warn("[resolvePartnerDiscount]", e?.message);
    return null;
  }

  if (found.length === 0) return null;
  return found.reduce((best, d) => (d.percent > best.percent ? d : best));
}

// Money off a subtotal, rounded to cents and never more than the subtotal.
export function partnerDiscountAmount(discount, subtotal) {
  const sub = Number(subtotal) || 0;
  if (!discount?.percent || sub <= 0) return 0;
  return Math.min(sub, Math.round((sub * discount.percent) / 100 * 100) / 100);
}

// Validates a partner-discount payload from the dashboard. Returns
// { value } or { error } — this directly reduces what clients are charged.
export function sanitizePartnerDiscount(p) {
  if (!p || p.active === false) {
    return { value: { active: false, percent: 0, label: "" } };
  }
  const percent = Number(p.percent);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return { error: "Discount must be between 1 and 100 percent" };
  }
  return {
    value: {
      active:  true,
      percent,
      label:   String(p.label || "Partner pricing").slice(0, 60),
      setAt:   new Date().toISOString(),
    },
  };
}
