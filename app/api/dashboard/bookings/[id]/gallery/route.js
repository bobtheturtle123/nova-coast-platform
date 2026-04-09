import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);

  const bookingDoc = await bookingRef.get();
  if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const booking = bookingDoc.data();

  if (booking.galleryId) {
    return Response.json({ galleryId: booking.galleryId });
  }

  const galleryId    = uuidv4();
  const accessToken  = uuidv4().replace(/-/g, "");

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(galleryId)
    .set({
      id:             galleryId,
      bookingId:      params.id,
      bookingAddress: booking.fullAddress || booking.address,
      tenantId:       ctx.tenantId,
      accessToken,
      unlocked:       false,
      media:          [],
      createdAt:      new Date(),
    });

  await bookingRef.update({ galleryId, galleryUnlocked: false });

  return Response.json({ galleryId, accessToken });
}
