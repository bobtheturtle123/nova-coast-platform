/**
 * Twilio SMS helper
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   (e.g. +12025551234)
 */
import { trackPlatformUsage } from "@/lib/usageTracking";

const DEFAULT_SMS_TEMPLATES = {
  bookingConfirmedClient:       "{{bizName}}: Your booking for {{address}} is confirmed!{{shootInfo}} Reply STOP to unsubscribe.",
  bookingConfirmedPhotographer: "{{bizName}}: New shoot assigned - {{address}}. Client: {{clientName}}.{{shootInfo}} Log in to view details.",
  mediaDeliveredClient:         "{{bizName}}: Your photos for {{address}} are ready!{{galleryLink}} Reply STOP to unsubscribe.",
  mediaDeliveredPhotographer:   "{{bizName}}: Media delivered to {{clientName}} for {{address}}.",
  shootReminderClient:          "{{bizName}} reminder: Your photo shoot for {{address}} is tomorrow{{timeStr}}. Reply STOP to unsubscribe.",
  shootReminderPhotographer:    "{{bizName}} reminder: Shoot tomorrow{{timeStr}} - {{address}}. Client: {{clientName}} ({{clientPhone}}).",
};

function applySmsPlaceholders(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

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
    console.warn("[sms] Twilio not configured - set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
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

  const clientConsented = booking.source === "manual" || booking.smsConsent === true;
  if (prefs.bookingConfirmed.client && booking.clientPhone && clientConsented) {
    const tpl = tenant?.smsTemplates?.bookingConfirmedClient || DEFAULT_SMS_TEMPLATES.bookingConfirmedClient;
    sends.push(sendSms(
      booking.clientPhone,
      applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "", shootInfo })
    ));
  }

  if (prefs.bookingConfirmed.photographer) {
    const phone = photographerPhone || booking.photographerPhone;
    if (phone) {
      const tpl = tenant?.smsTemplates?.bookingConfirmedPhotographer || DEFAULT_SMS_TEMPLATES.bookingConfirmedPhotographer;
      sends.push(sendSms(
        phone,
        applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "", shootInfo })
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
    const tpl = tenant?.smsTemplates?.mediaDeliveredClient || DEFAULT_SMS_TEMPLATES.mediaDeliveredClient;
    sends.push(sendSms(
      booking.clientPhone,
      applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "", galleryLink: galleryUrl ? ` View: ${galleryUrl}` : "" })
    ));
  }

  if (prefs.mediaDelivered.photographer && booking.photographerPhone) {
    const tpl = tenant?.smsTemplates?.mediaDeliveredPhotographer || DEFAULT_SMS_TEMPLATES.mediaDeliveredPhotographer;
    sends.push(sendSms(
      booking.photographerPhone,
      applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "" })
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
    const tpl = tenant?.smsTemplates?.shootReminderClient || DEFAULT_SMS_TEMPLATES.shootReminderClient;
    sends.push(sendSms(
      booking.clientPhone,
      applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "", timeStr })
    ));
  }

  if (prefs.shootReminder.photographer && booking.photographerPhone) {
    const tpl = tenant?.smsTemplates?.shootReminderPhotographer || DEFAULT_SMS_TEMPLATES.shootReminderPhotographer;
    sends.push(sendSms(
      booking.photographerPhone,
      applySmsPlaceholders(tpl, { bizName, address, clientName: booking.clientName || "", clientPhone: booking.clientPhone || "no phone", timeStr })
    ));
  }

  await Promise.allSettled(sends);
}
