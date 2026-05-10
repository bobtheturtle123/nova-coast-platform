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
  const PAGE_SIZE  = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const afterParam = searchParams.get("after");

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  let query = tenantRef
    .collection("bookings")
    .orderBy("createdAt", "desc")
    .limit(PAGE_SIZE + 1);

  if (afterParam) {
    query = query.startAfter(new Date(afterParam));
  }

  const snap = await query.get();

  const hasMore = snap.docs.length > PAGE_SIZE;
  const docs    = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

  const lastDoc     = docs[docs.length - 1];
  const lastCreated = lastDoc?.data().createdAt;
  const nextCursor  = lastCreated
    ? (lastCreated.toDate ? lastCreated.toDate().toISOString() : new Date(lastCreated).toISOString())
    : null;

  const bookings = docs.map((d) => {
    const data = d.data();
    for (const key of ["createdAt", "updatedAt", "preferredDate", "shootDate"]) {
      if (data[key]?._seconds) data[key] = new Date(data[key]._seconds * 1000).toISOString();
      else if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
    }
    return { id: d.id, ...data };
  });

  return Response.json({ bookings, hasMore, nextCursor });
}
