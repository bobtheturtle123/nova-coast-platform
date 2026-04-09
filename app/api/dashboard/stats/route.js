import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingsSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings")
    .orderBy("createdAt", "desc")
    .get();

  const bookings = bookingsSnap.docs.map((d) => d.data());

  const stats = {
    total:     bookings.length,
    pending:   bookings.filter((b) => b.status === "requested").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    revenue:   bookings.reduce((sum, b) => sum + (b.depositPaid ? (b.depositAmount || 0) : 0), 0),
    outstanding: bookings.reduce((sum, b) => sum + (!b.balancePaid ? (b.remainingBalance || 0) : 0), 0),
  };

  const recentBookings = bookings.slice(0, 5);

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenant    = tenantDoc.exists ? tenantDoc.data() : null;

  return Response.json({ stats, recentBookings, tenant });
}
