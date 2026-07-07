import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendScheduleConfirmed } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { logBookingActivity } from "@/lib/activityLog";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const d = await adminAuth.verifyIdToken(auth);
    if (!d.tenantId) return null;
    return { tenantId: d.tenantId };
  } catch { return null; }
}

function fmtWhen(dateStr, timeStr) {
  if (!dateStr) return "the new date";
  const d = new Date(`${dateStr}T${timeStr || "12:00:00"}`);
  const dl = isNaN(d) ? dateStr : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return timeStr ? `${dl} at ${/^\d/.test(timeStr) ? new Date(`1970-01-01T${timeStr}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : timeStr}` : dl;
}

// POST — notify the customer/agent that their shoot was rescheduled (email + SMS
// per the tenant's notification settings). Keeps the client in the loop so their
// own calendar reflects the new time.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const snap = await bookingRef.get();
  if (!snap.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const booking = snap.data();
  const tenant  = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  const shootDate = booking.shootDate?.split?.("T")?.[0] || booking.shootDate;
  const shootTime = booking.shootTime || null;
  const whenText  = fmtWhen(shootDate, shootTime);

  let emailSent = false, smsSent = false;

  // Email — respects the appointment_scheduled email preference (default on).
  const emailOn = tenant?.notificationPrefs?.appointment_scheduled?.channels?.email !== false;
  if (emailOn && booking.clientEmail) {
    try { await sendScheduleConfirmed({ booking, tenant, shootDate, shootTime }); emailSent = true; } catch (e) { console.error("[notify-reschedule] email failed:", e?.message); }
  }

  // SMS — only when the tenant has SMS enabled for appointment updates
  // (opt-in). sendSms no-ops if Twilio isn't configured.
  const smsOn = tenant?.notificationPrefs?.appointment_scheduled?.channels?.sms === true;
  if (smsOn && booking.clientPhone) {
    try {
      await sendSms(booking.clientPhone, `${tenant.businessName || "Your photographer"}: your shoot at ${booking.fullAddress || booking.address || "your property"} has been rescheduled to ${whenText}.`);
      smsSent = true;
    } catch (e) { console.error("[notify-reschedule] SMS failed:", e?.message); }
  }

  logBookingActivity(ctx.tenantId, params.id, {
    type:      "reschedule_notice",
    title:     `Reschedule notice sent — ${whenText}`,
    channel:   [emailSent && "email", smsSent && "sms"].filter(Boolean).join(" + ") || null,
    recipient: booking.clientEmail || booking.clientPhone || null,
    message:   `Notified ${booking.clientName || "the client"} that the shoot at ${booking.fullAddress || booking.address || "the property"} was rescheduled to ${whenText}.`,
  }).catch(() => {});

  return Response.json({ ok: true, emailSent, smsSent });
}
