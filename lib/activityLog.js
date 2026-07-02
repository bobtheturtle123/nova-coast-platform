import { adminDb } from "@/lib/firebase-admin";

// Records an activity event on a booking so the listing's Activity tab can show
// everything the tenant sent (invoices, reminders, deposit/gallery links,
// deliveries, payments) with the actual message and any generated link.
//
// event: {
//   type,        // e.g. "invoice_sent", "reminder_sent", "deposit_link",
//                //      "gallery_delivered", "agent_access", "payment"
//   title,       // short label for the row
//   message,     // the full message/body actually sent (expandable in the UI)
//   recipient,   // email/phone it went to
//   link,        // any generated URL to re-copy later
//   channel,     // "email" | "sms" | null
//   meta,        // optional extra fields
// }
export async function logBookingActivity(tenantId, bookingId, event = {}) {
  if (!tenantId || !bookingId) return;
  try {
    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings").doc(bookingId)
      .collection("activityLog")
      .add({
        type:      event.type || "note",
        title:     event.title || "",
        message:   event.message || null,
        recipient: event.recipient || null,
        link:      event.link || null,
        channel:   event.channel || null,
        meta:      event.meta || null,
        timestamp: new Date(),
      });
  } catch (e) {
    // Non-fatal — never block the actual send on logging.
    console.warn("[logBookingActivity]", e?.message);
  }
}
