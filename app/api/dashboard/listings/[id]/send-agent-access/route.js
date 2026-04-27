import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { rateLimitTenant } from "@/lib/rateLimit";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — generate agent access token and optionally send email
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 10 agent portal emails per tenant per hour
  const rl = await rateLimitTenant(ctx.tenantId, "send-agent-access", 10, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests. Please wait before sending more portal emails." }, { status: 429 });

  const { sendEmail = true } = await req.json().catch(() => ({}));

  // Fetch the booking
  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });

  const booking = bookingDoc.data();
  if (!booking.clientEmail) return Response.json({ error: "No client email on this booking" }, { status: 400 });

  const tenant = await getTenantById(ctx.tenantId);
  if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

  // Look up / create agent record
  const agentKey = Buffer.from(booking.clientEmail.toLowerCase().trim())
    .toString("base64")
    .replace(/[+/=]/g, "");
  const agentRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("agents").doc(agentKey);
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

  // Send email if requested and Resend is configured
  if (sendEmail && process.env.RESEND_API_KEY) {
    const primary  = tenant.branding?.primaryColor || "#0b2a55";
    const bizName  = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
    const from     = tenant.branding?.fromEmail
      ? `${bizName} <${tenant.branding.fromEmail}>`
      : `${bizName} <noreply@shootflow.com>`;
    const address  = booking.fullAddress || booking.address || "your property";

    try {
      await getResend()?.emails.send({
        from,
        to:      [booking.clientEmail],
        subject: `Your media portal is ready — ${address}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#fff">
            <h2 style="font-family:Georgia,serif;color:${primary};font-size:24px;margin:0 0 16px">
              Your media portal is ready
            </h2>
            <p style="color:#555;margin:0 0 12px">Hi ${booking.clientName?.split(" ")[0] || "there"},</p>
            <p style="color:#555;margin:0 0 20px">
              Your media and marketing tools for <strong>${address}</strong> are ready in your agent portal.
            </p>
            <p style="color:#555;margin:0 0 8px">From your portal you can:</p>
            <ul style="color:#555;margin:0 0 24px;padding-left:20px;line-height:1.8">
              <li>View and download photos &amp; videos</li>
              <li>Access your property website</li>
              <li>Download a print-ready brochure</li>
              <li>Generate social media captions</li>
              <li>Get your QR code</li>
            </ul>
            <a href="${portalUrl}"
               style="display:inline-block;background:${primary};color:#fff;font-family:sans-serif;
                      font-size:15px;font-weight:600;padding:14px 32px;border-radius:4px;text-decoration:none;margin-bottom:28px">
              Open My Portal →
            </a>
            <p style="color:#aaa;font-size:12px;margin:24px 0 0">
              Bookmark this link — it's your permanent access to all listings from ${bizName}.
            </p>
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0"/>
            <p style="color:#ccc;font-size:11px;text-align:center">Powered by ShootFlow · ${bizName}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[send-agent-access] Email error (non-fatal):", emailErr);
    }
  }

  return Response.json({ ok: true, portalUrl, accessToken });
}
