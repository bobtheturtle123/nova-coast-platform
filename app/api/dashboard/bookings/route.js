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

  const { searchParams } = new URL(req.url);
  const limitParam = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings")
    .orderBy("createdAt", "desc")
    .limit(limitParam)
    .get();

  const bookings = snap.docs.map((d) => {
    const data = d.data();
    // Serialize Firestore Timestamps to ISO strings
    for (const key of ["createdAt", "updatedAt", "preferredDate", "shootDate"]) {
      if (data[key]?._seconds) data[key] = new Date(data[key]._seconds * 1000).toISOString();
      else if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
    }
    return { id: d.id, ...data };
  });
  return Response.json({ bookings });
}
