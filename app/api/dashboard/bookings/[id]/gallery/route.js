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

  const galleryId   = uuidv4();
  // Use crypto-strength token (32 bytes = 64 hex chars, not enumerable)
  const { randomBytes } = await import("crypto");
  const accessToken = randomBytes(32).toString("hex");

  // Fetch tenant slug so gallery preview links can be constructed
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenantSlug = tenantDoc.exists ? tenantDoc.data().slug : "";

  const batch = adminDb.batch();

  batch.set(
    adminDb.collection("tenants").doc(ctx.tenantId).collection("galleries").doc(galleryId),
    {
      id:             galleryId,
      bookingId:      params.id,
      bookingAddress: booking.fullAddress || booking.address,
      clientName:     booking.clientName  || "",
      clientEmail:    booking.clientEmail || "",
      tenantId:       ctx.tenantId,
      tenantSlug,
      accessToken,
      unlocked:       false,
      media:          [],
      categories:     {},
      createdAt:      new Date(),
    }
  );

  // Register token in top-level index for O(1) tenant-safe lookup
  batch.set(
    adminDb.collection("galleryTokens").doc(accessToken),
    { tenantId: ctx.tenantId, galleryId }
  );

  await batch.commit();
  await bookingRef.update({ galleryId, galleryUnlocked: false });

  return Response.json({ galleryId, accessToken });
}
