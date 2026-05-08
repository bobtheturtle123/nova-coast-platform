import { adminDb } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendGalleryDelivery } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendMediaDeliveredSms } from "@/lib/sms";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron/gallery-deliveries] CRON_SECRET env var is not set — aborting");
    return new Response("Server misconfiguration", { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[cron/gallery-deliveries] Unauthorized — bad or missing Authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  const now  = new Date();
  let sent   = 0;
  let errors = 0;
  let skipped = 0;

  console.log(`[cron/gallery-deliveries] Starting run at ${now.toISOString()}`);

  try {
    const snap = await adminDb
      .collection("scheduledDeliveries")
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();

    console.log(`[cron/gallery-deliveries] Found ${snap.size} pending deliveries due`);

    await Promise.allSettled(
      snap.docs.map(async (doc) => {
        const job = doc.data();
        const { tenantId, galleryId, subject, note, to, cc } = job;

        const schedAt = job.scheduledAt?.toDate?.() ?? new Date(job.scheduledAt?._seconds * 1000);
        console.log(`[cron/gallery-deliveries] Processing job ${doc.id} — gallery ${galleryId} scheduled ${schedAt?.toISOString()}`);

        try {
          // Claim the job atomically — prevents duplicate sends if cron overlaps
          const galleryRef = adminDb
            .collection("tenants").doc(tenantId)
            .collection("galleries").doc(galleryId);

          await Promise.all([
            doc.ref.update({ status: "processing" }),
            galleryRef.update({ "scheduledDelivery.status": "processing" }).catch(() => {}),
          ]);

          const [galleryDoc, tenant] = await Promise.all([
            galleryRef.get(),
            getTenantById(tenantId),
          ]);

          if (!galleryDoc.exists) {
            console.warn(`[cron/gallery-deliveries] Gallery ${galleryId} not found — cancelling job ${doc.id}`);
            await doc.ref.update({ status: "cancelled", error: "gallery not found" });
            skipped++;
            return;
          }

          const gallery = galleryDoc.data();

          const bookingDoc = await adminDb
            .collection("tenants").doc(tenantId)
            .collection("bookings").doc(gallery.bookingId)
            .get();

          if (!bookingDoc.exists) {
            console.warn(`[cron/gallery-deliveries] Booking ${gallery.bookingId} not found — cancelling job ${doc.id}`);
            await doc.ref.update({ status: "cancelled", error: "booking not found" });
            skipped++;
            return;
          }

          const booking = bookingDoc.data();

          console.log(`[cron/gallery-deliveries] Sending gallery delivery email for job ${doc.id} to ${(to || []).join(", ")}`);

          await sendGalleryDelivery({
            booking,
            galleryToken: gallery.accessToken,
            tenant,
            subject,
            note,
            to:  to  || [],
            cc:  cc  || [],
          });

          console.log(`[cron/gallery-deliveries] Email sent for job ${doc.id}`);

          // Add recipients to authorized emails list (same as immediate delivery)
          const allRecipients  = [...new Set([...(to || []), ...(cc || [])])];
          const existingAuth   = gallery.authorizedEmails || [];
          const mergedAuth     = [...new Set([...existingAuth, ...allRecipients])];

          await Promise.all([
            galleryRef.update({
              delivered:          true,
              deliveredAt:        now,
              scheduledDelivery:  null,
              authorizedEmails:   mergedAuth,
            }),
            doc.ref.update({ status: "sent", sentAt: now }),
          ]);

          // Fire-and-forget side effects
          const appUrl     = getAppUrl();
          const galleryUrl = gallery.accessToken
            ? `${appUrl}/${tenant?.slug}/gallery/${gallery.accessToken}`
            : null;

          sendAgentPortalEmail({ tenantId, booking, tenant, reason: "delivery" }).catch((e) => {
            console.warn(`[cron/gallery-deliveries] Agent portal email failed for job ${doc.id}:`, e.message);
          });
          sendMediaDeliveredSms({ booking, tenant, galleryUrl }).catch((e) => {
            console.warn(`[cron/gallery-deliveries] SMS failed for job ${doc.id}:`, e.message);
          });

          sent++;
          console.log(`[cron/gallery-deliveries] Job ${doc.id} complete — sent=${sent}`);
        } catch (err) {
          console.error(`[cron/gallery-deliveries] Failed for job ${doc.id} (gallery ${galleryId}):`, err);
          const galleryRef = adminDb
            .collection("tenants").doc(tenantId)
            .collection("galleries").doc(galleryId);
          await Promise.all([
            doc.ref.update({ status: "error", error: err.message }).catch(() => {}),
            galleryRef.update({ "scheduledDelivery.status": "error" }).catch(() => {}),
          ]);
          errors++;
        }
      })
    );
  } catch (err) {
    console.error("[cron/gallery-deliveries] Fatal error querying scheduledDeliveries:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }

  console.log(`[cron/gallery-deliveries] Run complete — sent=${sent} errors=${errors} skipped=${skipped}`);
  return Response.json({ ok: true, sent, errors, skipped });
}
