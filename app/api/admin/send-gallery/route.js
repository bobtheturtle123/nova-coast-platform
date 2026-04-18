import { adminDb, adminAuth } from "@/lib/firebase-admin";
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

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { bookingId, galleryId } = await req.json();

    // Scope both queries to the authenticated tenant
    const [bookingSnap, gallerySnap] = await Promise.all([
      adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(bookingId).get(),
      adminDb.collection("tenants").doc(ctx.tenantId).collection("galleries").doc(galleryId).get(),
    ]);

    if (!bookingSnap.exists || !gallerySnap.exists) {
      return Response.json({ error: "Booking or gallery not found" }, { status: 404 });
    }

    const booking = bookingSnap.data();
    const gallery = gallerySnap.data();

    await sendGalleryDelivery({ booking, galleryToken: gallery.accessToken });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Send gallery email error:", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
