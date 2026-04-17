import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { syncBookingToQB } from "@/lib/quickbooks";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/quickbooks/sync
// Body: { bookingId }
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId } = await req.json().catch(() => ({}));
  if (!bookingId) return Response.json({ error: "bookingId required" }, { status: 400 });

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const qbTokens  = tenantDoc.data()?.quickbooks;
  if (!qbTokens?.accessToken) {
    return Response.json({ error: "QuickBooks not connected. Connect in Settings → Integrations." }, { status: 400 });
  }

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(bookingId)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = { id: bookingDoc.id, ...bookingDoc.data() };
  const result  = await syncBookingToQB(ctx.tenantId, booking, qbTokens);

  return Response.json({ ok: true, ...result });
}
