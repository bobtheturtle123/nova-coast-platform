/**
 * Twilio SMS helper
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (e.g. +12025551234)
 */
import { trackPlatformUsage } from "@/lib/usageTracking";

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
  if (!isConfigured()) {
    console.warn("[sms] Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
    return false;
  }
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
    trackPlatformUsage("smsSent");
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
 * Merge saved prefs with defaults.
 * Checks the new `notificationPrefs` format (from the Notifications page) first,
 * then falls back to the legacy `smsNotifications` format, then to defaults.
 *
 * notificationPrefs shape: { [notifId]: { channels: { sms: boolean } } }
 * Legacy smsNotifications shape: { bookingConfirmed: { client, photographer }, ... }
 */
export function mergeSmsPrefs(saved, notificationPrefs) {
  const d  = DEFAULT_SMS_PREFS;
  const np = notificationPrefs || {};

  // Helper: check new format first, then old format, then default
  function resolve(npKey, legacyVal, defaultVal) {
    if (np[npKey]?.channels?.sms !== undefined) return np[npKey].channels.sms;
    if (legacyVal !== undefined) return legacyVal;
    return defaultVal;
  }

  return {
    bookingConfirmed: {
      client:       resolve("order_confirmation",      saved?.bookingConfirmed?.client,       d.bookingConfirmed.client),
      photographer: resolve("team_order_received",     saved?.bookingConfirmed?.photographer, d.bookingConfirmed.photographer),
    },
    mediaDelivered: {
      client:       resolve("listing_delivered",       saved?.mediaDelivered?.client,       d.mediaDelivered.client),
      photographer: resolve("team_order_received",     saved?.mediaDelivered?.photographer, d.mediaDelivered.photographer),
    },
    shootReminder: {
      client:           resolve("appointment_reminder",      saved?.shootReminder?.client,           d.shootReminder.client),
      photographer:     resolve("team_appointment_reminder", saved?.shootReminder?.photographer,     d.shootReminder.photographer),
      hoursBeforeShoot: saved?.shootReminder?.hoursBeforeShoot ?? d.shootReminder.hoursBeforeShoot,
    },
  };
}

/**
 * Send booking-confirmed SMS to client and/or photographer based on tenant prefs.
 */
export async function sendBookingConfirmedSms({ booking, tenant, photographerPhone }) {
  const prefs = mergeSmsPrefs(tenant?.smsNotifications, tenant?.notificationPrefs);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";
  const shootInfo = booking.shootDate
    ? ` Shoot scheduled: ${new Date(booking.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${booking.shootTime ? ` at ${booking.shootTime}` : ""}.`
    : "";

  const sends = [];

  // For public bookings, require explicit SMS consent (smsConsent stored at booking time).
  // For manually-created bookings (source === "manual"), admin has verified consent directly.
  const clientConsented = booking.source === "manual" || booking.smsConsent === true;
  if (prefs.bookingConfirmed.client && booking.clientPhone && clientConsented) {
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
  const prefs = mergeSmsPrefs(tenant?.smsNotifications, tenant?.notificationPrefs);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";

  const sends = [];

  const clientConsented = booking.source === "manual" || booking.smsConsent === true;
  if (prefs.mediaDelivered.client && booking.clientPhone && clientConsented) {
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
  const prefs = mergeSmsPrefs(tenant?.smsNotifications, tenant?.notificationPrefs);
  if (!isConfigured()) return;

  const bizName = tenant?.branding?.businessName || tenant?.businessName || "Your Photographer";
  const address = booking.fullAddress || booking.address || "your property";
  const timeStr = booking.shootTime ? ` at ${booking.shootTime}` : "";

  const sends = [];

  const clientConsented = booking.source === "manual" || booking.smsConsent === true;
  if (prefs.shootReminder.client && booking.clientPhone && clientConsented) {
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
