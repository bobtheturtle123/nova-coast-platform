import { adminDb } from "@/lib/firebase-admin";
import { sendBookingApproved } from "@/lib/email";

export async function POST(req) {
  try {
    const { bookingId } = await req.json();

    const snap = await adminDb.collection("bookings").doc(bookingId).get();
    if (!snap.exists) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = snap.data();
    await sendBookingApproved({ booking });

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
