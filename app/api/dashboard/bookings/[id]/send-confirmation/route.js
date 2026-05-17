import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendBookingApproved } from "@/lib/email";
import { safeDate } from "@/lib/dateUtils";

const EMAIL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between sends of same type

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
  const doc = await bookingRef.get();

  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const booking = doc.data();

  // Cooldown: prevent re-sending confirmation within 4 hours
  const lastSent = safeDate(booking.emailCooldowns?.confirmation);
  if (lastSent && Date.now() - lastSent.getTime() < EMAIL_COOLDOWN_MS) {
    return Response.json({ error: "Confirmation was recently sent. Please wait before resending." }, { status: 429 });
  }

  const tenant = await getTenantById(ctx.tenantId);

  await sendBookingApproved({ booking, tenant });

  const TERMINAL_STATUSES = ["completed", "cancelled", "refunded"];
  const statusUpdate = TERMINAL_STATUSES.includes(booking.status) ? {} : { status: "confirmed" };
  await bookingRef.update({
    ...statusUpdate,
    "emailCooldowns.confirmation": new Date(),
  });

  return Response.json({ ok: true });
}
