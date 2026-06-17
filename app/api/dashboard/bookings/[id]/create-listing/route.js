import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { tenantHasActivePlan, paymentRequired } from "@/lib/requireSubscription";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — activate a booking as a listing (sets isListing: true)
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await tenantHasActivePlan(ctx.tenantId))) return paymentRequired();

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);

  const snap = await bookingRef.get();
  if (!snap.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  await bookingRef.update({ isListing: true, updatedAt: new Date() });

  return Response.json({ ok: true });
}
