import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendGalleryDelivery, sendGalleryDeliveryStatusEmail } from "@/lib/email";
import { sendMediaDeliveredSms } from "@/lib/sms";
import { getAppUrl } from "@/lib/appUrl";
import { safeDate } from "@/lib/dateUtils";
import { getEffectivePlan } from "@/lib/plans";
import { resolveActor } from "@/lib/actor";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return {
      tenantId: decoded.tenantId,
      uid:      decoded.uid,
      email:    decoded.email,
      memberId: decoded.memberId,
    };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { subject, note, to, cc, scheduledAt, websiteUrl, tourUrl, agentCanShare } = body;

  // Who is sending — recorded on every activity entry below so the Activity tab
  // shows which team member delivered, not just that a delivery happened.
  const actor = await resolveActor(ctx);

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
      // Carried into the activity log when the cron actually sends it.
      scheduledById:   actor.id,
      scheduledByName: actor.name,
      scheduledByRole: actor.role,
    });
    await batch.commit();
    await galleryRef.update({ scheduledDelivery: { scheduledAt: schedTime, status: "pending" } });
    return Response.json({ ok: true, scheduled: true, scheduledAt: schedTime.toISOString() });
  }

  // ── Guard: no media uploaded yet ─────────────────────────────────────────
  if (!gallery.media || gallery.media.filter((m) => !m.hidden).length === 0) {
    return Response.json({ error: "Gallery has no media to deliver" }, { status: 400 });
  }

  // ── Idempotency: prevent duplicate sends within 60 seconds ────────────────
  if (gallery.delivered && gallery.deliveredAt) {
    const lastSentMs = gallery.deliveredAt?.toMillis?.() || new Date(gallery.deliveredAt).getTime();
    if (Date.now() - lastSentMs < 60_000) {
      return Response.json({ error: "Gallery was already delivered less than 60 seconds ago" }, { status: 409 });
    }
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
    ? `${getAppUrl()}/${tenant.slug}/property/${gallery.bookingId}`
    : null);
  const resolvedTourUrl = tourUrl || booking.propertyWebsite?.matterportUrl || null;

  let deliveryError = null;
  try {
    await sendGalleryDelivery({ booking, galleryToken: gallery.accessToken, tenant, subject, note, to, cc, websiteUrl: resolvedWebsiteUrl, tourUrl: resolvedTourUrl });
  } catch (err) {
    deliveryError = err?.message || "Unknown delivery error";
    console.error("[send/gallery] sendGalleryDelivery failed:", deliveryError);
  }

  // Notify the tenant regardless of success/failure
  sendGalleryDeliveryStatusEmail({ tenant, booking, success: !deliveryError, errorMessage: deliveryError }).catch(() => {});

  if (deliveryError) {
    return Response.json({ error: `Gallery delivery failed: ${deliveryError}` }, { status: 500 });
  }

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

  // Record the delivery in the gallery activity log so the tenant can see when
  // (and to whom) it was sent.
  galleryRef.collection("activityLog").add({
    event:     "delivered",
    timestamp: new Date(),
    recipients: allRecipients,
    note:      allRecipients.length ? `Sent to ${allRecipients.join(", ")}` : null,
    actorId:   actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  }).catch(() => {});

  // Advance booking workflow status to "delivered" + log to listing activity
  // with the actual message and the (re-copyable) gallery link.
  if (gallery.bookingId) {
    adminDb.collection("tenants").doc(ctx.tenantId)
      .collection("bookings").doc(gallery.bookingId)
      .update({ workflowStatus: "delivered" })
      .catch((e) => console.error("[send/gallery] workflowStatus update failed:", e?.message));

    const galleryLink = gallery.accessToken ? `${getAppUrl()}/${tenant.slug}/gallery/${gallery.accessToken}` : null;
    import("@/lib/activityLog").then((m) => m.logBookingActivity(ctx.tenantId, gallery.bookingId, {
      type:      "gallery_delivered",
      title:     `Gallery delivered${allRecipients.length ? ` to ${allRecipients.join(", ")}` : ""}`,
      channel:   "email",
      actorId:   actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      recipient: allRecipients.join(", ") || null,
      link:      galleryLink,
      message:   `${subject ? subject + "\n\n" : ""}${note || "Your media is ready."}${galleryLink ? `\n\nGallery: ${galleryLink}` : ""}`,
    })).catch(() => {});
  }

  // Cancel any pending scheduled delivery for this gallery since we just sent
  const pendingSnap = await adminDb
    .collection("scheduledDeliveries")
    .where("tenantId", "==", ctx.tenantId)
    .where("galleryId", "==", params.id)
    .where("status", "==", "pending")
    .get();
  pendingSnap.docs.forEach((d) => d.ref.update({ status: "cancelled" }).catch(() => {}));

  // NOTE: we intentionally do NOT auto-send the agent-portal email here.
  // The gallery delivery email above is the single notification the client
  // gets. The owner can still send the portal link manually from the listing
  // if they want — sending both was redundant ("2 notifications").

  // SMS notifications — Studio and Pro plans only
  const SMS_PLANS = ["studio", "pro", "scale", "unlimited"];
  if (SMS_PLANS.includes(getEffectivePlan(tenant))) {
    const appUrl     = getAppUrl();
    const galleryUrl = gallery.accessToken ? `${appUrl}/${tenant?.slug}/gallery/${gallery.accessToken}` : null;
    sendMediaDeliveredSms({ booking, tenant, galleryUrl }).catch(() => {});
  }

  // Zapier webhook (fire-and-forget)
  (async () => {
    try {
      const { dispatchZapier, bookingWebhookData } = await import("@/lib/zapier");
      await dispatchZapier(tenant, "booking.delivered", bookingWebhookData({ ...booking, status: "delivered" }));
    } catch {}
  })();

  return Response.json({ ok: true });
}

// PATCH — retry a failed scheduled delivery (reset error → pending)
export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const errorSnap = await adminDb
    .collection("scheduledDeliveries")
    .where("tenantId", "==", ctx.tenantId)
    .where("galleryId", "==", params.id)
    .where("status", "==", "error")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (errorSnap.empty) return Response.json({ error: "No failed delivery found" }, { status: 404 });

  const failedDoc = errorSnap.docs[0];
  const schedAt = safeDate(failedDoc.data().scheduledAt);

  // Reset the scheduled time to 2 minutes from now if the original time has already passed
  const retryAt = (schedAt && schedAt > new Date()) ? schedAt : new Date(Date.now() + 2 * 60 * 1000);

  await Promise.all([
    failedDoc.ref.update({ status: "pending", scheduledAt: retryAt, error: null }),
    galleryRef.update({ scheduledDelivery: { scheduledAt: retryAt, status: "pending" } }),
  ]);

  return Response.json({ ok: true, retryAt: retryAt.toISOString() });
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
