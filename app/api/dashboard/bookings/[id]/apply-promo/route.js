import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — validate and apply a promo code to a booking
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code?.trim()) return Response.json({ error: "Code is required" }, { status: 400 });

  const normalized = code.trim().toUpperCase();

  // Load booking
  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);
  const bookingDoc = await bookingRef.get();
  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });
  const booking = bookingDoc.data();

  // Look up the promo code
  const promoSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("promoCodes")
    .where("code", "==", normalized)
    .limit(1)
    .get();

  if (promoSnap.empty) return Response.json({ error: "Promo code not found" }, { status: 404 });
  const promoDoc  = promoSnap.docs[0];
  const promo     = promoDoc.data();

  // Validation
  if (!promo.active) {
    return Response.json({ error: "This promo code is inactive" }, { status: 400 });
  }
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return Response.json({ error: "This promo code has expired" }, { status: 400 });
  }
  if (promo.usageLimit > 0 && promo.usageCount >= promo.usageLimit) {
    return Response.json({ error: "This promo code has reached its usage limit" }, { status: 400 });
  }

  const orderTotal = booking.totalPrice || 0;
  if (promo.minOrder > 0 && orderTotal < promo.minOrder) {
    return Response.json({
      error: `This code requires a minimum order of $${promo.minOrder}`,
    }, { status: 400 });
  }

  // Calculate discount
  let discount = 0;
  if (promo.type === "percent") {
    discount = Math.round(orderTotal * (promo.value / 100) * 100) / 100;
  } else {
    discount = Math.min(promo.value, orderTotal);
  }

  // Apply to booking and increment usage
  await Promise.all([
    bookingRef.update({
      promoCode:     normalized,
      promoDiscount: discount,
      updatedAt:     new Date(),
    }),
    promoDoc.ref.update({ usageCount: FieldValue.increment(1) }),
  ]);

  return Response.json({ ok: true, discount, code: normalized });
}

// DELETE — remove the applied promo code from a booking
export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);
  const bookingDoc = await bookingRef.get();
  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();
  const appliedCode = booking.promoCode;

  // Decrement usage count on the promo code
  if (appliedCode) {
    const promoSnap = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("promoCodes")
      .where("code", "==", appliedCode)
      .limit(1)
      .get();
    if (!promoSnap.empty) {
      const cur = promoSnap.docs[0].data().usageCount || 0;
      if (cur > 0) {
        promoSnap.docs[0].ref.update({ usageCount: FieldValue.increment(-1) }).catch(() => {});
      }
    }
  }

  await bookingRef.update({
    promoCode:     null,
    promoDiscount: null,
    updatedAt:     new Date(),
  });

  return Response.json({ ok: true });
}
