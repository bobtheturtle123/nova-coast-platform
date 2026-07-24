import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { validatePromo } from "@/lib/promo";

async function getTenantId(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    return decoded.tenantId || null;
  } catch { return null; }
}

// POST /api/dashboard/promo-codes/validate
// Body: { code, subtotal }
// Validates a promo code for the manual-booking form. Usage is NOT incremented
// here — the booking doesn't exist yet; the create route applies and counts it.
export async function POST(req) {
  const tenantId = await getTenantId(req);
  if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { code, subtotal = 0 } = await req.json().catch(() => ({}));
  if (!code?.trim()) return Response.json({ valid: false, message: "Enter a promo code" }, { status: 400 });

  const normalized = code.trim().toUpperCase();
  const snap = await adminDb
    .collection("tenants").doc(tenantId)
    .collection("promoCodes")
    .where("code", "==", normalized)
    .limit(1)
    .get();

  if (snap.empty) return Response.json({ valid: false, message: "Invalid promo code" });

  const doc   = snap.docs[0];
  const promo = doc.data();
  const result = validatePromo(promo, subtotal);
  if (!result.ok) return Response.json({ valid: false, message: result.error });

  return Response.json({
    valid:      true,
    code:       normalized,
    promoId:    doc.id,
    type:       promo.type,
    value:      promo.value,
    discount:   result.discount,
    finalTotal: Math.max(0, (Number(subtotal) || 0) - result.discount),
    message:    promo.type === "flat" ? `$${promo.value} off applied` : `${promo.value}% off applied`,
  });
}
