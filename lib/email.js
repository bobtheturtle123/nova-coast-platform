import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Nova Coast Media <hello@novacoastmedia.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.novacoastmedia.com";

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CONFIRMATION
// Sent immediately after deposit is paid
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBookingConfirmation({ booking }) {
  const { clientName, clientEmail, address, shootDate, totalPrice, deposit } = booking;

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "To be confirmed";

  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Booking received — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        We've received your booking.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        Your shoot request is under review. We'll confirm within 24 hours.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Property</td>
            <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${address}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Requested Date</td>
            <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${date}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Deposit Paid</td>
            <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500;color:#0b2a55">$${deposit}</td></tr>
        <tr><td style="padding:10px 0;color:#888;font-size:13px">Remaining Balance</td>
            <td style="padding:10px 0;font-weight:500">$${totalPrice - deposit} (due at delivery)</td></tr>
      </table>

      <p style="color:#888;font-size:13px;margin:0">
        Questions? Reply to this email or call us at (818) 934-1277.
      </p>
    `),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CONFIRMED (admin approves)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBookingApproved({ booking }) {
  const { clientName, clientEmail, address, shootDate } = booking;

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "TBD";

  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Shoot confirmed — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        Your shoot is confirmed.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        We'll see you on <strong>${date}</strong> at ${address}.
      </p>
      <p style="color:#888;font-size:13px">
        We'll send your media gallery link within 48 hours of the shoot.
        Your remaining balance will be due at that time.
      </p>
    `),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY DELIVERY
// ─────────────────────────────────────────────────────────────────────────────
export async function sendGalleryDelivery({ booking, galleryToken }) {
  const { clientName, clientEmail, address, balance } = booking;
  const galleryUrl = `${APP_URL}/gallery/${galleryToken}`;

  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Your media is ready — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        Your photos are ready.
      </h2>
      <p style="color:#555;margin:0 0 28px">
        Your media for <strong>${address}</strong> is now available to view.
        Pay your remaining balance to unlock full downloads.
      </p>

      <a href="${galleryUrl}"
         style="display:inline-block;background:#0b2a55;color:#fff;
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none;
                margin-bottom:28px">
        View Gallery
      </a>

      <p style="color:#888;font-size:13px;margin:0">
        Remaining balance due: <strong>$${balance}</strong>
      </p>
    `),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT REMINDER
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPaymentReminder({ booking, galleryToken }) {
  const { clientEmail, address, balance } = booking;
  const galleryUrl = `${APP_URL}/gallery/${galleryToken}`;

  await resend.emails.send({
    from: FROM,
    to: clientEmail,
    subject: `Friendly reminder — balance due for ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        Your remaining balance is due.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        Pay $${balance} to unlock full download access to your media.
      </p>
      <a href="${galleryUrl}"
         style="display:inline-block;background:#c9a96e;color:#0b2a55;
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none">
        Pay & Download
      </a>
    `),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HTML WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
function emailWrapper(body) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#f5f5f0;font-family:'DM Sans',Helvetica,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:40px 16px">
          <table width="560" cellpadding="0" cellspacing="0"
                 style="background:#fff;border-radius:4px;overflow:hidden">
            <!-- Header -->
            <tr><td style="background:#0b2a55;padding:24px 40px">
              <span style="color:#c9a96e;font-family:Georgia,serif;font-size:20px;
                           font-weight:400;letter-spacing:0.05em">
                NOVA COAST MEDIA
              </span>
            </td></tr>
            <!-- Body -->
            <tr><td style="padding:40px">
              ${body}
            </td></tr>
            <!-- Footer -->
            <tr><td style="padding:24px 40px;border-top:1px solid #eee;
                           font-size:12px;color:#aaa;text-align:center">
              Nova Coast Media · San Diego, CA · (818) 934-1277
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
