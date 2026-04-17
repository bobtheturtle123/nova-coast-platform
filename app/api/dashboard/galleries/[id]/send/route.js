import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendGalleryDelivery } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendMediaDeliveredSms } from "@/lib/sms";

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
  const { subject, note, to, cc } = body;

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

  await sendGalleryDelivery({ booking, galleryToken: gallery.accessToken, tenant, subject, note, to, cc });
  await galleryRef.update({ delivered: true, deliveredAt: new Date() });

  // Auto-send agent portal link on delivery (fire-and-forget)
  sendAgentPortalEmail({
    tenantId: ctx.tenantId,
    booking,
    tenant,
    reason: "delivery",
  }).catch(() => {});

  // SMS notifications — media delivered
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "";
  const galleryUrl = gallery.accessToken ? `${appUrl}/${tenant?.slug}/gallery/${gallery.accessToken}` : null;
  sendMediaDeliveredSms({ booking, tenant, galleryUrl }).catch(() => {});

  return Response.json({ ok: true });
}
