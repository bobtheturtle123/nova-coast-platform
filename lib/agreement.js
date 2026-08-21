// Service-agreement e-sign helper.
//
// One shared path for sending a booking's service agreement to the client as a
// "Review & Sign" link — used both when a manual booking is created with the
// "email agreement" option and when the tenant later resends or sends a reminder
// from the listing. It mints a stable, unguessable per-booking token for the
// signing link, sends the email, stamps agreementSentAt / agreementRemindedAt, and
// records the action in the booking's activity log so the listing's Activity tab
// shows it.
//
// Signing itself is captured by the public route /api/[slug]/agreement/[bookingId]
// (POST), which stamps the same contract* fields an online self-booking uses, so
// the "Signed Agreement" card lights up identically no matter how it was signed.

import { adminDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";
import { sendServiceAgreementEmail } from "@/lib/email";
import { logBookingActivity } from "@/lib/activityLog";
import { v4 as uuidv4 } from "uuid";

// Ensure the booking carries a stable signing token. Returns the existing token if
// present (so the link in an earlier email keeps working across resends), otherwise
// generates one and persists it.
async function ensureAgreementToken(tenantId, bookingId, existing) {
  if (existing) return existing;
  const token = uuidv4().replace(/-/g, "");
  await adminDb
    .collection("tenants").doc(tenantId)
    .collection("bookings").doc(bookingId)
    .update({ agreementToken: token })
    .catch(() => {});
  return token;
}

// Send (reminder=false) or re-nudge (reminder=true) the agreement for signing.
// `booking` should carry clientEmail/clientName and an address; `agreementText` is
// the current agreement copy (falls back to any text already stored on the booking,
// then the tenant's configured agreement). `actor` (optional) attributes the action
// to the team member in the activity log.
export async function sendAgreementForSigning({
  tenantId, tenant, booking, bookingId, agreementText = null, reminder = false, actor = null,
}) {
  if (!tenantId || !bookingId) return { ok: false, reason: "missing-ids" };
  if (!booking?.clientEmail) return { ok: false, reason: "no-client-email" };

  const text =
    agreementText ||
    booking.contractText ||
    tenant?.bookingConfig?.serviceAgreement?.text ||
    null;
  if (!text) return { ok: false, reason: "no-agreement-text" };

  const token   = await ensureAgreementToken(tenantId, bookingId, booking.agreementToken);
  const slug    = tenant?.slug;
  const signUrl = `${getAppUrl()}/${slug}/sign/${bookingId}?t=${token}`;

  await sendServiceAgreementEmail({ booking, agreementText: text, tenant, signUrl, reminder });

  const now = new Date();
  const stamp = reminder
    ? { agreementRemindedAt: now }
    : { agreementSentAt: now, agreementToken: token };
  await adminDb
    .collection("tenants").doc(tenantId)
    .collection("bookings").doc(bookingId)
    .update(stamp)
    .catch(() => {});

  await logBookingActivity(tenantId, bookingId, {
    type:      reminder ? "agreement_reminder_sent" : "agreement_sent",
    title:     reminder ? "Agreement reminder sent" : "Service agreement sent for signing",
    channel:   "email",
    recipient: booking.clientEmail,
    link:      signUrl,
    message:   reminder
      ? `Reminder sent to ${booking.clientEmail} to review and sign the service agreement.`
      : `Service agreement sent to ${booking.clientEmail} to review and sign.`,
    actorId:   actor?.id   || null,
    actorName: actor?.name || null,
    actorRole: actor?.role || null,
  });

  return { ok: true, signUrl, token };
}
