import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendPaymentReminder } from "@/lib/email";
import { safeDate } from "@/lib/dateUtils";

const EMAIL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between reminder sends

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/bookings/[id]/send-reminder
// Sends a payment reminder email to the client with a gallery link to pay the balance.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();

  if (!booking.galleryId) {
    return Response.json({ error: "Gallery not yet delivered. Send reminder after gallery is delivered." }, { status: 400 });
  }

  if (!booking.depositPaid || booking.paidInFull || booking.balancePaid) {
    return Response.json({ error: "No outstanding balance on this booking." }, { status: 400 });
  }

  // Cooldown: prevent spamming reminder emails
  const lastSent = safeDate(booking.emailCooldowns?.reminder);
  if (lastSent && Date.now() - lastSent.getTime() < EMAIL_COOLDOWN_MS) {
    return Response.json({ error: "Reminder was recently sent. Please wait before resending." }, { status: 429 });
  }

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  // Fetch gallery token for the payment link
  const galleryDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(booking.galleryId)
    .get();

  if (!galleryDoc.exists) {
    return Response.json({ error: "Gallery not found." }, { status: 404 });
  }

  const galleryToken = galleryDoc.data().token || booking.galleryId;

  await sendPaymentReminder({ booking, galleryToken, tenant });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ "emailCooldowns.reminder": new Date() });

  return Response.json({ ok: true });
}
