import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendGalleryDelivery } from "@/lib/email";

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

  const body = await req.json().catch(() => ({}));
  const { subject, note } = body;

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const galleryDoc = await galleryRef.get();
  if (!galleryDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const gallery = galleryDoc.data();

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(gallery.bookingId)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });
  const booking = bookingDoc.data();
  const tenant  = await getTenantById(ctx.tenantId);

  await sendGalleryDelivery({ booking, galleryToken: gallery.accessToken, tenant, subject, note });
  await galleryRef.update({ delivered: true, deliveredAt: new Date() });
  return Response.json({ ok: true });
}
