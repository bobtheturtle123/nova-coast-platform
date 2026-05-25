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

  const bookingsRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings");

  const thisYearStart = new Date(new Date().getFullYear(), 0, 1);

  // COUNT aggregation queries — read 0 documents, just return counts
  const [totalSnap, pendingSnap, confirmedSnap] = await Promise.all([
    bookingsRef.count().get(),
    bookingsRef.where("status", "==", "requested").count().get(),
    bookingsRef.where("status", "==", "confirmed").count().get(),
  ]);

  // Revenue/outstanding/listings: scan most recent 200 bookings (accurate for active pipeline)
  const [recentSnap, tenantDoc] = await Promise.all([
    bookingsRef.orderBy("createdAt", "desc").limit(200).get(),
    adminDb.collection("tenants").doc(ctx.tenantId).get(),
  ]);

  const recentData = recentSnap.docs.map((d) => d.data());

  const listingsThisYear = recentData.filter((b) => {
    if (b.isListing === false) return false;
    if (b.status === "pending_payment") return false;
    if (b.hidden) return false;
    const ts = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt);
    return ts >= thisYearStart;
  }).length;

  const stats = {
    total:            totalSnap.data().count,
    pending:          pendingSnap.data().count,
    confirmed:        confirmedSnap.data().count,
    listingsThisYear,
    revenue:          recentData.reduce((s, b) => s + (b.depositPaid ? (b.depositAmount || 0) : 0), 0),
    outstanding:      recentData.reduce((s, b) => s + (!b.balancePaid ? (b.remainingBalance || 0) : 0), 0),
  };

  const recentBookings = recentSnap.docs.slice(0, 5).map((d) => {
    const data = d.data();
    for (const key of ["createdAt", "updatedAt", "preferredDate", "shootDate"]) {
      if (data[key]?._seconds) data[key] = new Date(data[key]._seconds * 1000).toISOString();
      else if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
    }
    return { id: d.id, ...data };
  });

  const tenant = tenantDoc.exists ? tenantDoc.data() : null;

  return Response.json({ stats, recentBookings, tenant });
}
