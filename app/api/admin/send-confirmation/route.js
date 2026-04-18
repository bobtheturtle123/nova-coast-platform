import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendBookingApproved } from "@/lib/email";

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
    const { bookingId } = await req.json();

    // Scope to authenticated tenant — prevents cross-tenant access
    const snap = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("bookings").doc(bookingId)
      .get();

    if (!snap.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

    await sendBookingApproved({ booking: snap.data() });
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
