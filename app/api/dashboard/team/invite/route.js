import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";
import { getAppUrl } from "@/lib/appUrl";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role } = await req.json();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return Response.json({ error: "Valid email required." }, { status: 400 });
  }
  const validRoles = ["photographer", "editor", "manager", "admin"];
  const inviteRole = validRoles.includes(role) ? role : "photographer";

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenant    = tenantDoc.exists ? tenantDoc.data() : {};
  const company   = tenant.businessName || "Your media company";

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const inviteData = {
    email:     email.trim().toLowerCase(),
    tenantId:  ctx.tenantId,
    role:      inviteRole,
    createdAt: new Date(),
    expiresAt,
    accepted:  false,
  };

  // Store in top-level `photographerInvites` collection keyed by token
  // This avoids collectionGroup queries and prevents cross-tenant enumeration
  await adminDb.collection("photographerInvites").doc(token).set(inviteData);

  const appUrl    = getAppUrl();
  const inviteUrl = `${appUrl}/join/${token}`;

  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return Response.json({ ok: true, inviteUrl, emailFailed: true });
    await new Resend(key).emails.send({
      from:    "KyoriaOS <noreply@kyoriaos.com>",
      to:      email.trim(),
      subject: `${company} invited you to join their photography team`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #3486cf; margin-bottom: 8px;">You've been invited!</h2>
          <p style="color: #555; margin-bottom: 24px;">
            <strong>${company}</strong> has invited you to join their team on KyoriaOS.
          </p>
          <a href="${inviteUrl}"
            style="display: inline-block; background: #3486cf; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Accept Invitation
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This link expires in 7 days. If you weren't expecting this, you can ignore this email.
          </p>
          <p style="color: #ccc; font-size: 11px; margin-top: 8px;">${inviteUrl}</p>
        </div>
      `,
    });
  } catch {
    return Response.json({ ok: true, inviteUrl, emailFailed: true });
  }

  return Response.json({ ok: true });
}
