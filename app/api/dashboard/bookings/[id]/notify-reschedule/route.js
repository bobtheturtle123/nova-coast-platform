import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendSms } from "@/lib/sms";
import { logBookingActivity } from "@/lib/activityLog";
import { buildBookingIcs } from "@/lib/ics";

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

  // Email with an .ics calendar update — respects the appointment_scheduled
  // email preference (default on). A stable UID + incrementing SEQUENCE makes
  // the client's calendar UPDATE the existing event in place on reschedule.
  const emailOn = tenant?.notificationPrefs?.appointment_scheduled?.channels?.email !== false;
  if (emailOn && booking.clientEmail && process.env.RESEND_API_KEY) {
    try {
      const uid      = booking.icsUid || `booking-${params.id}@kyoriaos.com`;
      const sequence = (Number(booking.icsSequence) || 0) + 1;
      await bookingRef.update({ icsUid: uid, icsSequence: sequence });

      const ics = buildBookingIcs({ booking, tenant, shootDate, shootTime, uid, sequence, method: "REQUEST" });
      const biz = tenant?.branding?.businessName || tenant?.businessName || "Your photographer";
      const { Resend } = await import("resend");
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from:    `${biz} <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
        to:      booking.clientEmail,
        subject: `Rescheduled: your shoot at ${booking.fullAddress || booking.address || "your property"}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px 24px">
          <h2 style="color:#0F172A;margin:0 0 8px">Your shoot has been rescheduled</h2>
          <p style="color:#555;margin:0 0 4px">New date &amp; time:</p>
          <p style="font-size:18px;font-weight:700;color:#0F172A;margin:0 0 16px">${whenText}</p>
          <p style="color:#555;margin:0 0 4px">Location: <strong>${booking.fullAddress || booking.address || "your property"}</strong></p>
          <p style="color:#888;font-size:13px;margin-top:18px">The attached calendar invite will update the event on your calendar automatically.</p>
          <p style="color:#888;font-size:13px">— ${biz}</p>
        </div>`,
        attachments: [{
          filename: "shoot.ics",
          content: Buffer.from(ics).toString("base64"),
          contentType: 'text/calendar; method=REQUEST; name="shoot.ics"',
        }],
      });
      emailSent = true;
    } catch (e) { console.error("[notify-reschedule] email failed:", e?.message); }
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
