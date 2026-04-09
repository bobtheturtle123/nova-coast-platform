import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.shootflow.com";

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CONFIRMATION  (sent after deposit paid)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBookingConfirmation({ booking, tenant }) {
  const { clientName, clientEmail, address, shootDate, totalPrice, depositAmount } = booking;
  const from = tenantFrom(tenant);

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "To be confirmed";

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: `Booking received — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
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
            <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500;color:${tenant.branding.primaryColor}">$${depositAmount}</td></tr>
        <tr><td style="padding:10px 0;color:#888;font-size:13px">Remaining Balance</td>
            <td style="padding:10px 0;font-weight:500">$${totalPrice - depositAmount} (due at delivery)</td></tr>
      </table>
      <p style="color:#888;font-size:13px;margin:0">
        Questions? Reply to this email or contact ${tenant.businessName}.
      </p>
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING APPROVED  (admin confirms shoot)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBookingApproved({ booking, tenant }) {
  const { clientEmail, address, shootDate } = booking;
  const from = tenantFrom(tenant);

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "TBD";

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: `Shoot confirmed — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Your shoot is confirmed.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        We'll see you on <strong>${date}</strong> at ${address}.
      </p>
      <p style="color:#888;font-size:13px">
        We'll send your media gallery link within 48 hours of the shoot.
        Your remaining balance will be due at that time.
      </p>
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY DELIVERY
// ─────────────────────────────────────────────────────────────────────────────
export async function sendGalleryDelivery({ booking, galleryToken, tenant }) {
  const { clientEmail, address, remainingBalance } = booking;
  const from = tenantFrom(tenant);
  const galleryUrl = `${APP_URL}/${tenant.slug}/gallery/${galleryToken}`;

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: `Your media is ready — ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Your photos are ready.
      </h2>
      <p style="color:#555;margin:0 0 28px">
        Your media for <strong>${address}</strong> is now available to view.
        Pay your remaining balance to unlock full downloads.
      </p>
      <a href="${galleryUrl}"
         style="display:inline-block;background:${tenant.branding.primaryColor};color:#fff;
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none;margin-bottom:28px">
        View Gallery
      </a>
      <p style="color:#888;font-size:13px;margin:0">
        Remaining balance due: <strong>$${remainingBalance}</strong>
      </p>
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT REMINDER
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPaymentReminder({ booking, galleryToken, tenant }) {
  const { clientEmail, address, remainingBalance } = booking;
  const from = tenantFrom(tenant);
  const galleryUrl = `${APP_URL}/${tenant.slug}/gallery/${galleryToken}`;

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: `Friendly reminder — balance due for ${address}`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Your remaining balance is due.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        Pay $${remainingBalance} to unlock full download access to your media.
      </p>
      <a href="${galleryUrl}"
         style="display:inline-block;background:${tenant.branding.accentColor};color:${tenant.branding.primaryColor};
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none">
        Pay & Download
      </a>
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM: NEW TENANT WELCOME
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmail({ email, businessName, slug }) {
  const bookingUrl = `${APP_URL}/${slug}/book`;
  const dashUrl    = `${APP_URL}/dashboard`;

  await resend.emails.send({
    from: `ShootFlow <hello@shootflow.com>`,
    to: email,
    subject: `Welcome to ShootFlow, ${businessName}!`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        You're live on ShootFlow.
      </h2>
      <p style="color:#555;margin:0 0 24px">
        Your booking page is ready. Share it with clients and start taking deposits today.
      </p>
      <a href="${bookingUrl}"
         style="display:inline-block;background:#0b2a55;color:#fff;
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none;margin-bottom:24px">
        View Your Booking Page
      </a>
      <p style="color:#888;font-size:13px">
        Manage everything at <a href="${dashUrl}" style="color:#0b2a55">${dashUrl}</a>
      </p>
    `, { branding: { primaryColor: "#0b2a55", accentColor: "#c9a96e" }, businessName: "ShootFlow" }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function tenantFrom(tenant) {
  const name = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  // Use platform domain for now; tenants on Pro/Agency get custom from-address
  return `${name} <hello@shootflow.com>`;
}

function emailWrapper(body, tenant = {}) {
  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName || "ShootFlow";

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#f5f5f0;font-family:'DM Sans',Helvetica,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:40px 16px">
          <table width="560" cellpadding="0" cellspacing="0"
                 style="background:#fff;border-radius:4px;overflow:hidden">
            <tr><td style="background:${primary};padding:24px 40px">
              <span style="color:${accent};font-family:Georgia,serif;font-size:20px;
                           font-weight:400;letter-spacing:0.05em">
                ${name.toUpperCase()}
              </span>
            </td></tr>
            <tr><td style="padding:40px">${body}</td></tr>
            <tr><td style="padding:24px 40px;border-top:1px solid #eee;
                           font-size:12px;color:#aaa;text-align:center">
              Powered by <a href="${APP_URL}" style="color:#aaa">ShootFlow</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
