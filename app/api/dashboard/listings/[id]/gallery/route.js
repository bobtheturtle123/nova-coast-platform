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

function serialize(data) {
  const out = { ...data };
  for (const key of Object.keys(out)) {
    if (out[key]?.toDate) out[key] = out[key].toDate().toISOString();
    else if (out[key]?.seconds) out[key] = new Date(out[key].seconds * 1000).toISOString();
  }
  return out;
}

// GET /api/dashboard/listings/[bookingId]/gallery
// Returns the gallery associated with this booking (if any)
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  // Check booking for galleryId
  const bookingDoc = await tenantRef.collection("bookings").doc(params.id).get();
  if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const booking = bookingDoc.data();

  if (!booking.galleryId) {
    return Response.json({ gallery: null });
  }

  const galleryDoc = await tenantRef.collection("galleries").doc(booking.galleryId).get();
  if (!galleryDoc.exists) return Response.json({ gallery: null });

  return Response.json({ gallery: { id: galleryDoc.id, ...serialize(galleryDoc.data()) } });
}
