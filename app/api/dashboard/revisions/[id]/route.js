import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// PATCH /api/dashboard/revisions/[id]
// Body: { status: "acknowledged" | "resolved", adminNotes?: string }
export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { status, adminNotes } = await req.json();
  const allowed = ["acknowledged", "resolved"];
  if (!allowed.includes(status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }

  const ref = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("revisionRequests").doc(params.id);

  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Not found." }, { status: 404 });

  const update = {
    status,
    updatedAt: new Date(),
  };
  if (adminNotes !== undefined) update.adminNotes = String(adminNotes).slice(0, 2000);
  if (status === "resolved") update.resolvedAt = new Date();

  await ref.update(update);

  // Email agent when resolved
  if (status === "resolved") {
    try {
      const revData  = snap.data();
      const agentEmail = revData.agentEmail;
      const resendKey  = process.env.RESEND_API_KEY;
      if (resendKey && agentEmail) {
        // Fetch tenant branding for the email
        const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
        const tenant    = tenantDoc.data() || {};
        const primary   = tenant.branding?.primaryColor || "#3486cf";
        const bizName   = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
        const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
        const from      = `${bizName} <${fromEmail}>`;
        const portalUrl = revData.bookingId
          ? `${getAppUrl()}/${tenant.slug}/agent/${revData.bookingId}?token=`
          : `${getAppUrl()}/${tenant.slug}/agent`;

        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const { data: emailData, error: emailError } = await resend.emails.send({
          from,
          to: [agentEmail],
          subject: `Your revision request has been resolved`,
          html: `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:40px 20px">
            <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">Revision Resolved</h2>
            <p style="color:#555;margin:0 0 16px">Hi ${revData.agentName || "there"},</p>
            <p style="color:#555;margin:0 0 16px">Your revision request has been reviewed and resolved.</p>
            ${update.adminNotes ? `<div style="border-left:3px solid ${primary};padding-left:16px;color:#444;margin:0 0 20px;font-style:italic">${update.adminNotes}</div>` : ""}
            <a href="${portalUrl}" style="display:inline-block;background:${primary};color:#fff;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none">View in Portal →</a>
          </div>`,
        });
        if (emailError) {
          console.error("[revision] Resolution email failed — from:", from, "| to:", agentEmail, "| error:", JSON.stringify(emailError));
        } else {
          console.log("[revision] Resolution email sent — id:", emailData?.id, "| to:", agentEmail);
        }
      }
    } catch { /* non-fatal */ }
  }

  return Response.json({ ok: true });
}
