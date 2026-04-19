import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.nova-os.app";

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CONFIRMATION  (sent after deposit paid)
// ─────────────────────────────────────────────────────────────────────────────
function applyPlaceholders(str, vars) {
  return (str || "").replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export async function sendBookingConfirmation({ booking, tenant }) {
  const { clientName, clientEmail, address, shootDate, totalPrice, depositAmount } = booking;
  const from = tenantFrom(tenant);

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "To be confirmed";

  const vars = { clientName: clientName || "there", address: address || "", date };
  const tpl  = tenant.emailTemplates?.bookingReceived || {};
  const emailSubject = tpl.subject
    ? applyPlaceholders(tpl.subject, vars)
    : `Booking received — ${address}`;
  const customNote = tpl.body
    ? `<div style="color:#555;margin:0 0 20px;line-height:1.6;white-space:pre-wrap">${applyPlaceholders(tpl.body, vars)}</div>`
    : "";

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: emailSubject,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        We've received your booking.
      </h2>
      ${customNote || `<p style="color:#555;margin:0 0 24px">Your shoot request is under review. We'll confirm within 24 hours.</p>`}
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
  const { clientName, clientEmail, address, shootDate } = booking;
  const from = tenantFrom(tenant);

  const date = shootDate
    ? new Date(shootDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "TBD";

  const vars = { clientName: clientName || "there", address: address || "", date };
  const tpl  = tenant.emailTemplates?.bookingApproved || {};
  const emailSubject = tpl.subject
    ? applyPlaceholders(tpl.subject, vars)
    : `Shoot confirmed — ${address}`;
  const customNote = tpl.body
    ? `<div style="color:#555;margin:0 0 20px;line-height:1.6;white-space:pre-wrap">${applyPlaceholders(tpl.body, vars)}</div>`
    : "";

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: emailSubject,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Your shoot is confirmed.
      </h2>
      ${customNote || `<p style="color:#555;margin:0 0 24px">We'll see you on <strong>${date}</strong> at ${address}.</p>`}
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
export async function sendGalleryDelivery({ booking, galleryToken, tenant, subject, note, to, cc }) {
  const { clientName, clientEmail, address, remainingBalance } = booking;
  const from = tenantFrom(tenant);
  const galleryUrl = `${APP_URL}/${tenant.slug}/gallery/${galleryToken}`;
  const emailSubject = subject || tenant.emailTemplate?.subject?.replace("{{address}}", address) || `Your media is ready — ${address}`;
  // note may be plain text or HTML from rich text editor; fall back to tenant template body
  const resolvedNote = note || (tenant.emailTemplate?.body
    ? tenant.emailTemplate.body
        .replace("{{clientName}}", clientName || "")
        .replace("{{address}}", address || "")
    : "");
  const noteHtml = resolvedNote
    ? `<div style="color:#555;margin:0 0 20px;line-height:1.6;white-space:pre-wrap">${resolvedNote}</div>`
    : "";

  // Recipients: use provided to/cc or fall back to booking client email
  const toAddresses = (to && to.length > 0) ? to : [clientEmail];
  const ccAddresses = (cc && cc.length > 0) ? cc : undefined;

  await resend.emails.send({
    from,
    to: toAddresses,
    ...(ccAddresses ? { cc: ccAddresses } : {}),
    subject: emailSubject,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 12px">
        Your media is ready.
      </h2>
      <p style="color:#555;margin:0 0 16px">Hi ${clientName || "there"},</p>
      ${noteHtml}
      <p style="color:#555;margin:0 0 28px">
        Your media for <strong>${address}</strong> is ready to view and download.
      </p>
      <a href="${galleryUrl}"
         style="display:inline-block;background:${tenant.branding.primaryColor};color:#fff;
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none;margin-bottom:28px">
        View Gallery →
      </a>
      ${remainingBalance > 0 ? `<p style="color:#888;font-size:13px;margin:0">
        Remaining balance: <strong>$${remainingBalance}</strong> — pay from the gallery to unlock full downloads.
      </p>` : `<p style="color:#22c55e;font-size:13px;font-weight:600;margin:0">
        ✓ Fully paid — all downloads unlocked.
      </p>`}
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT REMINDER
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPaymentReminder({ booking, galleryToken, tenant }) {
  const { clientName, clientEmail, address, remainingBalance } = booking;
  const from = tenantFrom(tenant);
  const galleryUrl = `${APP_URL}/${tenant.slug}/gallery/${galleryToken}`;

  const vars = { clientName: clientName || "there", address: address || "", balance: remainingBalance ?? "" };
  const tpl  = tenant.emailTemplates?.paymentReminder || {};
  const emailSubject = tpl.subject
    ? applyPlaceholders(tpl.subject, vars)
    : `Friendly reminder — balance due for ${address}`;
  const customNote = tpl.body
    ? `<div style="color:#555;margin:0 0 20px;line-height:1.6;white-space:pre-wrap">${applyPlaceholders(tpl.body, vars)}</div>`
    : `<p style="color:#555;margin:0 0 24px">Pay $${remainingBalance} to unlock full download access to your media.</p>`;

  await resend.emails.send({
    from,
    to: clientEmail,
    subject: emailSubject,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Your remaining balance is due.
      </h2>
      ${customNote}
      <a href="${galleryUrl}"
         style="display:inline-block;background:${tenant.branding.accentColor};color:${tenant.branding.primaryColor};
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none">
        Pay &amp; Download
      </a>
    `, tenant),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE EMAIL  (admin-triggered, works with or without gallery)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendInvoiceEmail({ booking, paymentUrl, tenant }) {
  const { clientName, clientEmail, address, totalPrice, depositAmount, remainingBalance, depositPaid, paidInFull, balancePaid } = booking;
  const from = tenantFrom(tenant);

  const amountDue = paidInFull ? 0 : depositPaid ? (remainingBalance || 0) : (depositAmount || totalPrice || 0);
  const subject = paidInFull
    ? `Invoice — ${address} (Paid)`
    : `Invoice — ${address}`;

  const statusLine = paidInFull || balancePaid
    ? `<p style="color:#16a34a;font-weight:600;margin:0 0 24px">✓ Paid in full — $${(totalPrice || 0).toLocaleString()}</p>`
    : depositPaid
    ? `<p style="color:#555;margin:0 0 8px">Deposit paid: <strong>$${(depositAmount || 0).toLocaleString()}</strong></p>
       <p style="color:#d97706;margin:0 0 24px">Balance remaining: <strong>$${(remainingBalance || 0).toLocaleString()}</strong></p>`
    : `<p style="color:#555;margin:0 0 24px">Amount due: <strong>$${(amountDue || 0).toLocaleString()}</strong></p>`;

  await resend.emails.send({
    from,
    to: clientEmail,
    subject,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${tenant.branding.primaryColor};font-size:24px;margin:0 0 8px">
        Invoice — ${address}
      </h2>
      <p style="color:#555;margin:0 0 16px">Hi ${clientName || "there"},</p>
      ${statusLine}
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
        <tr><td style="padding:6px 0;color:#888">Property</td><td style="padding:6px 0;text-align:right;font-weight:600">${address}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Total</td><td style="padding:6px 0;text-align:right">$${(totalPrice || 0).toLocaleString()}</td></tr>
        ${depositAmount ? `<tr><td style="padding:6px 0;color:#888">Deposit</td><td style="padding:6px 0;text-align:right">${depositPaid ? '✓ ' : ''}$${(depositAmount || 0).toLocaleString()}</td></tr>` : ""}
        ${!paidInFull && !balancePaid && amountDue > 0 ? `<tr style="border-top:1px solid #eee"><td style="padding:8px 0;font-weight:600">Amount due</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#d97706">$${amountDue.toLocaleString()}</td></tr>` : ""}
      </table>
      ${paymentUrl && amountDue > 0 ? `
      <a href="${paymentUrl}"
         style="display:inline-block;background:${tenant.branding.accentColor};color:${tenant.branding.primaryColor};
                font-family:sans-serif;font-size:15px;font-weight:600;
                padding:14px 32px;border-radius:2px;text-decoration:none">
        Pay Now →
      </a>` : ""}
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
    from: `NovaOS <hello@nova-os.app>`,
    to: email,
    subject: `Welcome to NovaOS, ${businessName}!`,
    html: emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:#0b2a55;font-size:24px;margin:0 0 8px">
        You're live on NovaOS.
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
    `, { branding: { primaryColor: "#0b2a55", accentColor: "#c9a96e" }, businessName: "NovaOS" }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR INVITE HELPER
// ─────────────────────────────────────────────────────────────────────────────
export function generateCalendarICS({ summary, description, location, startISO, durationMinutes = 120 }) {
  if (!startISO) return null;
  const start = new Date(startISO);
  const end   = new Date(start.getTime() + durationMinutes * 60 * 1000);

  function fmt(d) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@nova-os.app`;
  const safe = (s) => (s || "").replace(/[,\\;]/g, " ").replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NovaOS//NovaOS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${safe(summary)}`,
    `DESCRIPTION:${safe(description)}`,
    `LOCATION:${safe(location)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Upcoming shoot reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CREATED NOTIFICATION  (manual bookings — to admin + client + photographer)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendBookingCreatedNotifications({ booking, tenant, adminEmail }) {
  const {
    clientName, clientEmail, clientPhone, address, preferredDate, preferredTime,
    totalPrice, depositAmount, notes, photographerEmail, photographerName,
    packageName, serviceNames, addonNames, propertyType, squareFootage,
    twilightTime, weatherEnabled,
  } = booking;

  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const biz     = tenant.branding?.businessName || tenant.businessName || "NovaOS";

  const shootDate = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "To be confirmed";
  const shootTime = preferredTime
    ? formatTime12Email(preferredTime)
    : "Time to be confirmed";
  const duration = tenant.bookingConfig?.availability?.defaultDuration || 120;

  // Google Calendar link
  let googleCalLink = "";
  if (preferredDate && preferredTime) {
    const [h, m] = preferredTime.split(":").map(Number);
    const startDt = new Date(preferredDate + "T12:00:00");
    startDt.setHours(h, m, 0, 0);
    const endDt = new Date(startDt.getTime() + duration * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
    const calText = encodeURIComponent(`Photo Shoot — ${address}`);
    const calDates = `${fmt(startDt)}/${fmt(endDt)}`;
    const calLoc = encodeURIComponent(address);
    googleCalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calText}&dates=${calDates}&location=${calLoc}`;
  }

  // Build calendar ICS if we have a date+time
  let icsContent = null;
  if (preferredDate && preferredTime) {
    const startISO = `${preferredDate}T${preferredTime}:00`;
    icsContent = generateCalendarICS({
      summary:     `📷 Photo Shoot — ${address}`,
      description: `Photographer: ${biz}\nClient: ${clientName}\nTotal: $${totalPrice || 0}`,
      location:    address,
      startISO,
      durationMinutes: duration,
    });
  }
  const calAttachment = icsContent
    ? [{ filename: "shoot-appointment.ics", content: Buffer.from(icsContent).toString("base64") }]
    : [];

  const detailsTable = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:40%">Property</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${address}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Date</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${shootDate}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Time</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${shootTime}${twilightTime ? ` · Twilight: ${formatTime12Email(twilightTime)}` : ""}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Total</td>
          <td style="padding:10px 0;font-weight:600;color:${primary}">$${(totalPrice || 0).toLocaleString()}</td></tr>
    </table>
  `;

  const sends = [];

  // 1 — Client confirmation
  sends.push(resend.emails.send({
    from:    tenantFrom(tenant),
    to:      clientEmail,
    subject: `Shoot confirmed — ${address}`,
    html:    emailWrapper(`
      <h2 style="font-family:Georgia,serif;color:${primary};font-size:24px;margin:0 0 8px">Your shoot is booked.</h2>
      <p style="color:#555;margin:0 0 24px">Hi ${clientName || "there"} — your photography session has been scheduled.</p>
      ${detailsTable}
      ${googleCalLink ? `<a href="${googleCalLink}" target="_blank" style="display:inline-block;margin-bottom:20px;font-size:13px;color:${primary};text-decoration:none;border:1px solid #ddd;border-radius:4px;padding:8px 16px;">📅 Add to Google Calendar</a>` : ""}
      ${notes ? `<p style="color:#888;font-size:13px;font-style:italic;margin:0">"${notes}"</p>` : ""}
    `, tenant),
    ...(calAttachment.length ? { attachments: calAttachment } : {}),
  }));

  // 2 — Admin notification
  if (adminEmail) {
    sends.push(resend.emails.send({
      from:    `NovaOS <hello@nova-os.app>`,
      to:      adminEmail,
      subject: `New booking — ${address}`,
      html:    emailWrapper(`
        <h2 style="font-family:Georgia,serif;color:${primary};font-size:22px;margin:0 0 8px">New booking created.</h2>
        <p style="color:#555;margin:0 0 4px"><strong>${clientName}</strong> · ${clientEmail}${clientPhone ? ` · ${clientPhone}` : ""}</p>
        ${notes ? `<p style="color:#888;font-size:13px;margin:0 0 16px;font-style:italic">"${notes}"</p>` : ""}
        ${detailsTable}
      `, { branding: tenant.branding, businessName: biz }),
      ...(calAttachment.length ? { attachments: calAttachment } : {}),
    }));
  }

  // 3 — Photographer notification (full shoot details)
  if (photographerEmail) {
    const photoICS = icsContent
      ? generateCalendarICS({
          summary:  `📷 ${address}`,
          description: buildPhotographerDescription({ clientName, clientEmail, clientPhone, address, totalPrice, packageName, serviceNames, addonNames, propertyType, squareFootage, notes, twilightTime }),
          location: address,
          startISO: preferredDate && preferredTime ? `${preferredDate}T${preferredTime}:00` : null,
          durationMinutes: duration,
        })
      : null;

    const weatherRow = weatherEnabled && preferredDate
      ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Weather</td>
             <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px">
               <a href="https://forecast.weather.gov/MapClick.php?CityName=${encodeURIComponent(address)}" style="color:${primary}">Check forecast →</a>
             </td></tr>`
      : "";

    sends.push(resend.emails.send({
      from:    tenantFrom(tenant),
      to:      photographerEmail,
      subject: `Shoot assigned — ${address}`,
      html:    emailWrapper(`
        <h2 style="font-family:Georgia,serif;color:${primary};font-size:22px;margin:0 0 8px">You've been assigned a shoot.</h2>
        <p style="color:#555;margin:0 0 20px">Hi ${photographerName || "there"},</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:40%">Property</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${address}</td></tr>
          ${propertyType ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Property Type</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${propertyType}${squareFootage ? ` · ${Number(squareFootage).toLocaleString()} sqft` : ""}</td></tr>` : ""}
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Date</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${shootDate}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Time</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${shootTime}${twilightTime ? ` · Twilight: ${formatTime12Email(twilightTime)}` : ""}</td></tr>
          ${packageName ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Package</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${packageName}</td></tr>` : ""}
          ${serviceNames?.length ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Services</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${serviceNames.join(", ")}</td></tr>` : ""}
          ${addonNames?.length ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Add-ons</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${addonNames.join(", ")}</td></tr>` : ""}
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Client</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500">${clientName}${clientPhone ? ` · ${clientPhone}` : ""}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Client Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee">${clientEmail}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Total</td>
              <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;color:${primary}">$${(totalPrice || 0).toLocaleString()}</td></tr>
          ${weatherRow}
        </table>
        ${notes ? `<div style="background:#f9f9f7;border-left:3px solid ${accent};padding:12px 16px;border-radius:2px;margin-bottom:20px">
          <p style="color:#555;font-size:13px;margin:0;font-style:italic">"${notes}"</p>
        </div>` : ""}
        ${googleCalLink ? `<a href="${googleCalLink}" target="_blank" style="display:inline-block;font-size:13px;color:${primary};text-decoration:none;border:1px solid #ddd;border-radius:4px;padding:8px 16px;">📅 Add to Google Calendar</a>` : ""}
      `, tenant),
      ...(photoICS ? { attachments: [{ filename: "shoot-assignment.ics", content: Buffer.from(photoICS).toString("base64") }] } : {}),
    }));
  }

  await Promise.allSettled(sends);
}

function buildPhotographerDescription({ clientName, clientEmail, clientPhone, address, totalPrice, packageName, serviceNames, addonNames, propertyType, squareFootage, notes, twilightTime }) {
  const lines = [
    `Client: ${clientName}`,
    clientPhone ? `Phone: ${clientPhone}` : null,
    `Email: ${clientEmail}`,
    `Property: ${address}`,
    propertyType ? `Type: ${propertyType}${squareFootage ? ` · ${squareFootage} sqft` : ""}` : null,
    packageName ? `Package: ${packageName}` : null,
    serviceNames?.length ? `Services: ${serviceNames.join(", ")}` : null,
    addonNames?.length   ? `Add-ons: ${addonNames.join(", ")}`   : null,
    twilightTime ? `Twilight shoot: ${twilightTime}` : null,
    `Total: $${(totalPrice || 0).toLocaleString()}`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function formatTime12Email(t) {
  if (!t || typeof t !== "string") return t || "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function tenantFrom(tenant) {
  const name = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  // Use platform domain for now; tenants on Pro/Agency get custom from-address
  return `${name} <hello@nova-os.app>`;
}

function emailWrapper(body, tenant = {}) {
  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName || "NovaOS";

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
              Powered by <a href="${APP_URL}" style="color:#aaa">NovaOS</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
