import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { rateLimit } from "@/lib/rateLimit";
import { safeDate } from "@/lib/dateUtils";

// POST /api/[slug]/promo/validate
// Body: { code: string, subtotal: number }
// Returns: { valid, discount, type, value, finalTotal, message }
export async function POST(req, { params }) {
  // 10 attempts per IP per hour — prevents brute-force of promo codes
  const rl = await rateLimit(req, `promo-validate:${params.slug}`, 10, 3600);
  if (rl.limited) {
    return Response.json({ valid: false, message: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const { code, subtotal = 0 } = await req.json();

    if (!code?.trim()) {
      return Response.json({ valid: false, message: "Enter a promo code" }, { status: 400 });
    }

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ valid: false, message: "Invalid store" }, { status: 404 });

    const normalized = code.trim().toUpperCase();
    const snap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("promoCodes")
      .where("code", "==", normalized)
      .limit(1)
      .get();

    if (snap.empty) {
      return Response.json({ valid: false, message: "Invalid promo code" });
    }

    const promo = snap.docs[0].data();

    if (!promo.active) {
      return Response.json({ valid: false, message: "This code is no longer active" });
    }

    // Check expiry — treat unparseable dates as expired to be safe
    if (promo.expiresAt) {
      const expiry = safeDate(promo.expiresAt);
      if (!expiry || expiry < new Date()) {
        return Response.json({ valid: false, message: "This code has expired" });
      }
    }

    // Check usage limit
    if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
      return Response.json({ valid: false, message: "This code has reached its usage limit" });
    }

    // Check minimum order
    if (promo.minOrder > 0 && Number(subtotal) < promo.minOrder) {
      return Response.json({ valid: false, message: `Minimum order of $${promo.minOrder} required` });
    }

    // Calculate discount
    const sub = Number(subtotal) || 0;
    let discount = 0;
    if (promo.type === "flat") {
      discount = Math.min(promo.value, sub); // can't discount more than subtotal
    } else {
      discount = Math.round((sub * promo.value) / 100 * 100) / 100;
    }
    const finalTotal = Math.max(0, sub - discount);

    return Response.json({
      valid: true,
      promoId:    snap.docs[0].id,
      code:       normalized,
      type:       promo.type,
      value:      promo.value,
      discount,
      finalTotal,
      message:    promo.type === "flat"
        ? `$${promo.value} off applied`
        : `${promo.value}% off applied`,
    });
  } catch (err) {
    console.error("Promo validate error:", err);
    return Response.json({ valid: false, message: "Error validating code" }, { status: 500 });
  }
}
