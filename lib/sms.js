/**
 * Twilio SMS helper
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (e.g. +12025551234)
 */

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

/** Normalize a phone number to E.164. Returns null if unrecognizable. */
function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10)  return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  if (digits.length > 7)     return `+${digits}`;
  return null;
}

/**
 * Send an SMS via Twilio. Fire-and-forget safe (never throws).
 * Returns true on success, false on failure.
 */
export async function sendSms(to, body) {
  if (!isConfigured()) return false;
  const toNumber = toE164(to);
  if (!toNumber) return false;

  try {
    const sid  = process.env.TWILIO_ACCOUNT_SID;
    const auth = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type":  "application/x-www-form-urlencoded",
          Authorization:   "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
        },
        body: new URLSearchParams({ From: from, To: toNumber, Body: String(body).slice(0, 1600) }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("[sms] Twilio error:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sms] Send error:", err);
    return false;
  }
}

/**
 * Default SMS notification preferences for a new tenant.
 */
export const DEFAULT_SMS_PREFS = {
  bookingConfirmed: { client: true,  photographer: true  },
  mediaDelivered:   { client: true,  photographer: false },
  shootReminder:    { client: true,  photographer: true,  hoursBeforeShoot: 24 },
};

/**
 * Merge saved prefs with defaults so missing keys always resolve to false (safe default).
 */
export function mergeSmsPrefs(saved) {
  const d = DEFAULT_SMS_PREFS;
  return {
    bookingConfirmed: {
      client:       saved?.bookingConfirmed?.client       ?? d.bookingConfirmed.client,
      photographer: saved?.bookingConfirmed?.photographer ?? d.bookingConfirmed.photographer,
    },
    mediaDelivered: {
      client:       saved?.mediaDelivered?.client       ?? d.mediaDelivered.client,
      photographer: saved?.mediaDelivered?.photographer ?? d.mediaDelivered.photographer,
    },
    shootReminder: {
      client:           saved?.shootReminder?.client           ?? d.shootReminder.client,
      photographer:     saved?.shootReminder?.photographer     ?? d.shootReminder.photographer,
      hoursBeforeShoot: saved?.shootReminder?.hoursBeforeShoot ?? d.shootReminder.hoursBeforeShoot,
    },
  };
}

/**
 * Send booking-confirmed SMS to client and/or photographer based on tenant prefs.
 */
export async function sendBookingConfirmedSms({ booking, tenant, photographerPhone }) {
  const prefs = mergeSmsPrefs(tenant?.smsNotifications);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";
  const shootInfo = booking.shootDate
    ? ` Shoot scheduled: ${new Date(booking.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${booking.shootTime ? ` at ${booking.shootTime}` : ""}.`
    : "";

  const sends = [];

  if (prefs.bookingConfirmed.client && booking.clientPhone) {
    sends.push(sendSms(
      booking.clientPhone,
      `${bizName}: Your booking for ${address} is confirmed!${shootInfo} Reply STOP to unsubscribe.`
    ));
  }

  if (prefs.bookingConfirmed.photographer) {
    const phone = photographerPhone || booking.photographerPhone;
    if (phone) {
      sends.push(sendSms(
        phone,
        `${bizName}: New shoot assigned — ${address}. Client: ${booking.clientName}.${shootInfo} Log in to view details.`
      ));
    }
  }

  await Promise.allSettled(sends);
}

/**
 * Send media-delivered SMS to client and/or photographer based on tenant prefs.
 */
export async function sendMediaDeliveredSms({ booking, tenant, galleryUrl }) {
  const prefs = mergeSmsPrefs(tenant?.smsNotifications);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";

  const sends = [];

  if (prefs.mediaDelivered.client && booking.clientPhone) {
    sends.push(sendSms(
      booking.clientPhone,
      `${bizName}: Your photos for ${address} are ready!${galleryUrl ? ` View: ${galleryUrl}` : ""} Reply STOP to unsubscribe.`
    ));
  }

  if (prefs.mediaDelivered.photographer && booking.photographerPhone) {
    sends.push(sendSms(
      booking.photographerPhone,
      `${bizName}: Media delivered to ${booking.clientName} for ${address}.`
    ));
  }

  await Promise.allSettled(sends);
}

/**
 * Send shoot-reminder SMS. Called by the daily cron job.
 */
export async function sendShootReminderSms({ booking, tenant }) {
  const prefs = mergeSmsPrefs(tenant?.smsNotifications);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";
  const timeStr = booking.shootTime ? ` at ${booking.shootTime}` : "";

  const sends = [];

  if (prefs.shootReminder.client && booking.clientPhone) {
    sends.push(sendSms(
      booking.clientPhone,
      `${bizName} reminder: Your photo shoot for ${address} is tomorrow${timeStr}. Reply STOP to unsubscribe.`
    ));
  }

  if (prefs.shootReminder.photographer && booking.photographerPhone) {
    sends.push(sendSms(
      booking.photographerPhone,
      `${bizName} reminder: Shoot tomorrow${timeStr} — ${address}. Client: ${booking.clientName} (${booking.clientPhone || "no phone"}).`
    ));
  }

  await Promise.allSettled(sends);
}
