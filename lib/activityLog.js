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
// Idempotent payment activity: writes the entry under a deterministic doc id
// (derived from the Stripe PI/session/charge), so webhook retries and the
// success-page verification fallback update ONE entry instead of duplicating.
export async function logPaymentActivity(tenantId, bookingId, fields = {}) {
  if (!tenantId || !bookingId) return;
  try {
    const { buildPaymentEntry } = await import("@/lib/paymentActivity");
    const { key, doc } = buildPaymentEntry(fields);
    const ref = adminDb
      .collection("tenants").doc(tenantId)
      .collection("bookings").doc(bookingId)
      .collection("activityLog").doc(key);
    // Preserve the first-seen timestamp on retries/merges.
    const existing = await ref.get();
    await ref.set({ ...doc, timestamp: existing.exists ? existing.data().timestamp : new Date() }, { merge: true });
  } catch (e) {
    console.warn("[logPaymentActivity]", e?.message);
  }
}

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
        // Who performed the action (team member), when known.
        actorId:   event.actorId || null,
        actorName: event.actorName || null,
        actorRole: event.actorRole || null,
        timestamp: new Date(),
      });
  } catch (e) {
    // Non-fatal — never block the actual send on logging.
    console.warn("[logBookingActivity]", e?.message);
  }
}
