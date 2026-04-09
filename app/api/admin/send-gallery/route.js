import { adminDb } from "@/lib/firebase-admin";
import { sendGalleryDelivery } from "@/lib/email";

export async function POST(req) {
  try {
    const { bookingId, galleryId } = await req.json();

    const [bookingSnap, gallerySnap] = await Promise.all([
      adminDb.collection("bookings").doc(bookingId).get(),
      adminDb.collection("galleries").doc(galleryId).get(),
    ]);

    if (!bookingSnap.exists || !gallerySnap.exists) {
      return Response.json({ error: "Booking or gallery not found" }, { status: 404 });
    }

    const booking = bookingSnap.data();
    const gallery = gallerySnap.data();

    await sendGalleryDelivery({
      booking,
      galleryToken: gallery.accessToken,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Send gallery email error:", err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
