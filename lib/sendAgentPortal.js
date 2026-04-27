import { adminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * Ensures the agent has an accessToken, then sends (or re-sends) the portal email.
 * Safe to call multiple times — won't regenerate the token if one already exists.
 *
 * @param {{ tenantId: string, booking: object, tenant: object, reason?: "booking"|"delivery" }}
 */
export async function sendAgentPortalEmail({ tenantId, booking, tenant, reason = "booking" }) {
  if (!booking?.clientEmail) return;
  if (!process.env.RESEND_API_KEY) return;

  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  const agentKey  = Buffer.from(booking.clientEmail.toLowerCase().trim())
    .toString("base64")
    .replace(/[+/=]/g, "");
  const agentRef  = tenantRef.collection("agents").doc(agentKey);
  const agentSnap = await agentRef.get();

  let accessToken;
  if (agentSnap.exists && agentSnap.data().accessToken) {
    accessToken = agentSnap.data().accessToken;
  } else {
    accessToken = uuidv4().replace(/-/g, "");
    if (agentSnap.exists) {
      await agentRef.update({ accessToken });
    } else {
      await agentRef.set({
        id:          agentKey,
        name:        booking.clientName  || "",
        email:       booking.clientEmail,
        phone:       booking.clientPhone || "",
        accessToken,
        totalOrders: 1,
        totalSpent:  booking.totalPrice  || 0,
        lastOrderAt: new Date(),
        createdAt:   new Date(),
      });
    }
  }

  const portalUrl = `${APP_URL}/${tenant.slug}/agent?token=${accessToken}`;
  const primary   = tenant.branding?.primaryColor || "#0b2a55";
  const bizName   = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  const from      = tenant.branding?.fromEmail
    ? `${bizName} <${tenant.branding.fromEmail}>`
    : `${bizName} <noreply@kyoriaos.com>`;
  const address   = booking.fullAddress || booking.address || "your property";
  const firstName = booking.clientName?.split(" ")[0] || "there";

  const isDelivery = reason === "delivery";
  const subject    = isDelivery
    ? `Your photos are ready — ${address}`
    : `Your agent portal is ready — ${address}`;

  const introLine = isDelivery
    ? `Your photos for <strong>${address}</strong> have been delivered! You can view and download everything from your agent portal.`
    : `Your booking for <strong>${address}</strong> has been confirmed. Your agent portal is now active.`;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from,
    to:      [booking.clientEmail],
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#fff">
        <h2 style="font-family:Georgia,serif;color:${primary};font-size:24px;margin:0 0 16px">
          ${isDelivery ? "Your photos are ready" : "Your agent portal is ready"}
        </h2>
        <p style="color:#555;margin:0 0 12px">Hi ${firstName},</p>
        <p style="color:#555;margin:0 0 20px">${introLine}</p>
        <p style="color:#555;margin:0 0 8px">From your portal you can:</p>
        <ul style="color:#555;margin:0 0 24px;padding-left:20px;line-height:1.8">
          <li>View and download photos &amp; videos</li>
          <li>Access your property website</li>
          <li>Download a print-ready brochure</li>
          <li>Generate social media captions</li>
          <li>Get your shareable QR code</li>
        </ul>
        <a href="${portalUrl}"
           style="display:inline-block;background:${primary};color:#fff;font-family:sans-serif;
                  font-size:15px;font-weight:600;padding:14px 32px;border-radius:4px;text-decoration:none;margin-bottom:28px">
          ${isDelivery ? "View My Photos →" : "Open My Portal →"}
        </a>
        <p style="color:#aaa;font-size:12px;margin:24px 0 0">
          Bookmark this link — it's your permanent access to all listings from ${bizName}.
        </p>
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0"/>
        <p style="color:#ccc;font-size:11px;text-align:center">Powered by KyoriaOS - ${bizName}</p>
      </div>
    `,
  }).catch((err) => console.error("[sendAgentPortal] Email error (non-fatal):", err));

  return { portalUrl, accessToken };
}
