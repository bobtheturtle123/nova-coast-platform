import { adminDb } from "@/lib/firebase-admin";
import { sendShootReminderSms, mergeSmsPrefs } from "@/lib/sms";

// Called daily by Vercel Cron (see vercel.json).
// Finds all bookings whose shootDate is tomorrow and sends SMS reminders.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  let sent = 0;
  let errors = 0;

  try {
    // Query all tenants
    const tenantsSnap = await adminDb.collection("tenants").get();

    await Promise.allSettled(
      tenantsSnap.docs.map(async (tenantDoc) => {
        const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
        const prefs  = mergeSmsPrefs(tenant.smsNotifications, tenant.notificationPrefs);

        // Skip if neither client nor photographer reminders are enabled
        if (!prefs.shootReminder.client && !prefs.shootReminder.photographer) return;

        // Adjust hours — some tenants may want 48h, default 24h
        const hours   = prefs.shootReminder.hoursBeforeShoot || 24;
        const dayDiff = Math.round(hours / 24);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayDiff);
        const targetStr  = targetDate.toISOString().slice(0, 10);

        const bookingsSnap = await adminDb
          .collection("tenants").doc(tenant.id)
          .collection("bookings")
          .where("shootDate", ">=", targetStr + "T00:00:00")
          .where("shootDate", "<=", targetStr + "T23:59:59")
          .where("status", "in", ["confirmed", "requested"])
          .get();

        await Promise.allSettled(
          bookingsSnap.docs.map(async (bDoc) => {
            const booking = { id: bDoc.id, ...bDoc.data() };
            try {
              await sendShootReminderSms({ booking, tenant });
              sent++;
            } catch {
              errors++;
            }
          })
        );
      })
    );
  } catch (err) {
    console.error("[cron/shoot-reminders] Error:", err);
    return Response.json({ error: "Cron failed", details: err.message }, { status: 500 });
  }

  console.log(`[cron/shoot-reminders] sent=${sent} errors=${errors} target=${tomorrowStr}`);
  return Response.json({ ok: true, sent, errors, targetDate: tomorrowStr });
}
