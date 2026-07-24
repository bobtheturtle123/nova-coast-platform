import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validatePromo } from "@/lib/promo";

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

  // Validate against the PRE-discount order total (shared with the create flow).
  const orderTotal = booking.totalPrice || 0;
  const result = validatePromo(promo, orderTotal);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  const discount = result.discount;

  // Reduce the balance so the discount is actually collected, not just shown.
  // Restore any prior promo first so re-applying a different code is idempotent.
  // Replacing an existing code leaves usageCount as-is (net zero); a fresh
  // application increments it.
  const priorDiscount = booking.promoCode ? (booking.promoDiscount || 0) : 0;
  const basisRemaining = Math.max(0, (booking.remainingBalance || 0) + priorDiscount);
  const newRemaining   = Math.max(0, basisRemaining - discount);

  const updates = [
    bookingRef.update({
      promoCode:        normalized,
      promoDiscount:    discount,
      remainingBalance: newRemaining,
      updatedAt:        new Date(),
    }),
  ];
  if (!booking.promoCode) {
    updates.push(promoDoc.ref.update({ usageCount: FieldValue.increment(1) }));
  }
  await Promise.all(updates);

  return Response.json({ ok: true, discount, code: normalized, remainingBalance: newRemaining });
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

  // Add the discount back to the balance so removing the code un-does the charge
  // reduction it applied.
  const restoredRemaining = Math.max(0, (booking.remainingBalance || 0) + (booking.promoDiscount || 0));

  await bookingRef.update({
    promoCode:        null,
    promoDiscount:    null,
    remainingBalance: restoredRemaining,
    updatedAt:        new Date(),
  });

  return Response.json({ ok: true, remainingBalance: restoredRemaining });
}
