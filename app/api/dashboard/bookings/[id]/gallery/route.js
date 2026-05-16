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

  // Return existing gallery immediately if already created
  if (bookingDoc.data().galleryId) {
    const existing = bookingDoc.data().galleryId;
    const existingGallery = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("galleries").doc(existing)
      .get();
    return Response.json({
      galleryId:   existing,
      accessToken: existingGallery.exists ? existingGallery.data().accessToken : null,
    });
  }

  const galleryId   = uuidv4();
  const { randomBytes } = await import("crypto");
  const accessToken = randomBytes(32).toString("hex");

  // Fetch tenant slug so gallery preview links can be constructed
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenantSlug = tenantDoc.exists ? tenantDoc.data().slug : "";

  // Use a transaction to prevent duplicate galleries when concurrent requests race
  let alreadyExists = false;
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) return;
    if (snap.data().galleryId) { alreadyExists = snap.data().galleryId; return; }

    const booking = snap.data();
    const galleryRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("galleries").doc(galleryId);
    const tokenRef   = adminDb.collection("galleryTokens").doc(accessToken);

    tx.set(galleryRef, {
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
    });
    tx.set(tokenRef, { tenantId: ctx.tenantId, galleryId });
    tx.update(bookingRef, { galleryId, galleryUnlocked: false });
  });

  if (alreadyExists) {
    const existingGallery = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("galleries").doc(alreadyExists)
      .get();
    return Response.json({
      galleryId:   alreadyExists,
      accessToken: existingGallery.exists ? existingGallery.data().accessToken : null,
    });
  }

  return Response.json({ galleryId, accessToken });
}
