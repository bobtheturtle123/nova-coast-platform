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
  const statusFilter    = searchParams.get("status");    // pending | acknowledged | resolved | all
  const bookingIdFilter = searchParams.get("bookingId"); // optional

  let query = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("revisionRequests");

  if (statusFilter && statusFilter !== "all") {
    query = query.where("status", "==", statusFilter);
  }
  if (bookingIdFilter) {
    query = query.where("bookingId", "==", bookingIdFilter);
  }

  const snap = await query.limit(100).get();

  const revisions = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id:          doc.id,
      bookingId:   d.bookingId,
      galleryId:   d.galleryId,
      agentEmail:  d.agentEmail,
      agentName:   d.agentName,
      requestedAt: d.requestedAt?.toDate?.()?.toISOString?.() ?? d.requestedAt,
      status:      d.status,
      message:     d.message,
      mediaItems:  d.mediaItems || [],
      adminNotes:  d.adminNotes || "",
      resolvedAt:  d.resolvedAt?.toDate?.()?.toISOString?.() ?? d.resolvedAt,
    };
  }).sort((a, b) => (b.requestedAt || "") < (a.requestedAt || "") ? -1 : 1);

  return Response.json({ revisions });
}
