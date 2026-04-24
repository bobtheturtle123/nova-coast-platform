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
  const { subject, note, to, cc, scheduledAt, websiteUrl, tourUrl, agentCanShare } = body;

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const galleryDoc = await galleryRef.get();
  if (!galleryDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const gallery = galleryDoc.data();

  // ── Scheduled delivery ────────────────────────────────────────────────────
  if (scheduledAt) {
    const schedTime = new Date(scheduledAt);
    if (isNaN(schedTime.getTime())) {
      return Response.json({ error: "Invalid scheduledAt" }, { status: 400 });
    }
    if (schedTime <= new Date()) {
      return Response.json({ error: "Scheduled time must be in the future" }, { status: 400 });
    }
    // Cancel any existing pending scheduled delivery for this gallery
    const existingSnap = await adminDb
      .collection("scheduledDeliveries")
      .where("tenantId", "==", ctx.tenantId)
      .where("galleryId", "==", params.id)
      .where("status", "==", "pending")
      .get();
    const batch = adminDb.batch();
    existingSnap.docs.forEach((d) => batch.update(d.ref, { status: "cancelled" }));
    const newRef = adminDb.collection("scheduledDeliveries").doc();
    batch.set(newRef, {
      tenantId:    ctx.tenantId,
      galleryId:   params.id,
      scheduledAt: schedTime,
      subject:     subject || null,
      note:        note    || null,
      to:          to      || [],
      cc:          cc      || [],
      status:      "pending",
      createdAt:   new Date(),
    });
    await batch.commit();
    await galleryRef.update({ scheduledDelivery: { scheduledAt: schedTime, status: "pending" } });
    return Response.json({ ok: true, scheduled: true, scheduledAt: schedTime.toISOString() });
  }

  // ── Immediate delivery ────────────────────────────────────────────────────
  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(gallery.bookingId)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });
  const booking = bookingDoc.data();
  const tenant  = await getTenantById(ctx.tenantId);

  // Auto-include website and 3D tour links from booking if not overridden
  const resolvedWebsiteUrl = websiteUrl || (booking.propertyWebsite?.published
    ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/${tenant.slug}/property/${gallery.bookingId}`
    : null);
  const resolvedTourUrl = tourUrl || booking.propertyWebsite?.matterportUrl || null;

  await sendGalleryDelivery({ booking, galleryToken: gallery.accessToken, tenant, subject, note, to, cc, websiteUrl: resolvedWebsiteUrl, tourUrl: resolvedTourUrl });
  const allRecipients = [...new Set([...(to || []), ...(cc || [])])];
  const existingAuth  = gallery.authorizedEmails || [];
  const mergedAuth    = [...new Set([...existingAuth, ...allRecipients])];
  await galleryRef.update({
    delivered: true,
    deliveredAt: new Date(),
    scheduledDelivery: null,
    authorizedEmails: mergedAuth,
    ...(agentCanShare !== undefined ? { agentCanShare } : {}),
  });

  // Cancel any pending scheduled delivery for this gallery since we just sent
  const pendingSnap = await adminDb
    .collection("scheduledDeliveries")
    .where("tenantId", "==", ctx.tenantId)
    .where("galleryId", "==", params.id)
    .where("status", "==", "pending")
    .get();
  pendingSnap.docs.forEach((d) => d.ref.update({ status: "cancelled" }).catch(() => {}));

  // Auto-send agent portal link on delivery (fire-and-forget)
  sendAgentPortalEmail({
    tenantId: ctx.tenantId,
    booking,
    tenant,
    reason: "delivery",
  }).catch(() => {});

  // SMS notifications — Studio and Pro plans only
  const SMS_PLANS = ["studio", "pro", "scale"];
  if (SMS_PLANS.includes(tenant?.subscriptionPlan)) {
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "";
    const galleryUrl = gallery.accessToken ? `${appUrl}/${tenant?.slug}/gallery/${gallery.accessToken}` : null;
    sendMediaDeliveredSms({ booking, tenant, galleryUrl }).catch(() => {});
  }

  return Response.json({ ok: true });
}

// DELETE — cancel a pending scheduled delivery
export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const snap = await adminDb
    .collection("scheduledDeliveries")
    .where("tenantId", "==", ctx.tenantId)
    .where("galleryId", "==", params.id)
    .where("status", "==", "pending")
    .get();

  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: "cancelled" }));
  batch.update(galleryRef, { scheduledDelivery: null });
  await batch.commit();

  return Response.json({ ok: true });
}
