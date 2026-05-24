import { adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

const OWNER_EMAIL = "complexdesign123@gmail.com";

async function verifyOwner(req) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email !== OWNER_EMAIL && decoded.role !== "superadmin") return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET — list all active promo codes you've created
export async function GET(req) {
  if (!await verifyOwner(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const codes = await stripe.promotionCodes.list({ limit: 50 });
    return Response.json({
      codes: codes.data.map((c) => ({
        id:          c.id,
        code:        c.code,
        active:      c.active,
        uses:        c.times_redeemed,
        maxUses:     c.max_redemptions,
        couponName:  c.coupon?.name || "",
        expiresAt:   c.expires_at ? new Date(c.expires_at * 1000).toLocaleDateString() : null,
      })),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a new 1-month-free promo code
export async function POST(req) {
  if (!await verifyOwner(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { code, maxUses = 1 } = await req.json().catch(() => ({}));

    // Create coupon: 100% off, applied once (first month free)
    const coupon = await stripe.coupons.create({
      percent_off:     100,
      duration:        "once",
      name:            "1 Month Free — Friend Referral",
    });

    // Create promotion code from that coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon:          coupon.id,
      max_redemptions: Number(maxUses) || 1,
      ...(code ? { code: code.toUpperCase().replace(/\s/g, "") } : {}),
    });

    return Response.json({
      code:        promoCode.code,
      id:          promoCode.id,
      couponId:    coupon.id,
      maxUses:     promoCode.max_redemptions,
      description: "100% off first month — applies once per customer",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — deactivate a promo code
export async function DELETE(req) {
  if (!await verifyOwner(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    await stripe.promotionCodes.update(id, { active: false });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
