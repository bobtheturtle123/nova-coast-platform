import { adminDb } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendGalleryDelivery } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendMediaDeliveredSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now  = new Date();
  let sent   = 0;
  let errors = 0;

  try {
    const snap = await adminDb
      .collection("scheduledDeliveries")
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();

    await Promise.allSettled(
      snap.docs.map(async (doc) => {
        const job = doc.data();
        const { tenantId, galleryId, subject, note, to, cc } = job;

        try {
          const galleryRef = adminDb
            .collection("tenants").doc(tenantId)
            .collection("galleries").doc(galleryId);

          const [galleryDoc, tenant] = await Promise.all([
            galleryRef.get(),
            getTenantById(tenantId),
          ]);

          if (!galleryDoc.exists) {
            await doc.ref.update({ status: "cancelled", error: "gallery not found" });
            return;
          }

          const gallery = galleryDoc.data();

          const bookingDoc = await adminDb
            .collection("tenants").doc(tenantId)
            .collection("bookings").doc(gallery.bookingId)
            .get();

          if (!bookingDoc.exists) {
            await doc.ref.update({ status: "cancelled", error: "booking not found" });
            return;
          }

          const booking = bookingDoc.data();

          await sendGalleryDelivery({
            booking,
            galleryToken: gallery.accessToken,
            tenant,
            subject,
            note,
            to:  to  || [],
            cc:  cc  || [],
          });

          await Promise.all([
            galleryRef.update({ delivered: true, deliveredAt: now, scheduledDelivery: null }),
            doc.ref.update({ status: "sent", sentAt: now }),
          ]);

          // Fire-and-forget side effects
          const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "";
          const galleryUrl = gallery.accessToken
            ? `${appUrl}/${tenant?.slug}/gallery/${gallery.accessToken}`
            : null;

          sendAgentPortalEmail({ tenantId, booking, tenant, reason: "delivery" }).catch(() => {});
          sendMediaDeliveredSms({ booking, tenant, galleryUrl }).catch(() => {});

          sent++;
        } catch (err) {
          console.error(`[cron/gallery-deliveries] Failed for ${galleryId}:`, err);
          await doc.ref.update({ status: "error", error: err.message }).catch(() => {});
          errors++;
        }
      })
    );
  } catch (err) {
    console.error("[cron/gallery-deliveries] Fatal error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }

  console.log(`[cron/gallery-deliveries] sent=${sent} errors=${errors}`);
  return Response.json({ ok: true, sent, errors });
}
