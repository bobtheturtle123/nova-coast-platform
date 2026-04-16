import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required." }, { status: 400 });
  }

  // Get tenant info for the invite email
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenant    = tenantDoc.exists ? tenantDoc.data() : {};
  const company   = tenant.businessName || "Your media company";

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Save invite to Firestore
  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("invites").doc(token)
    .set({
      email,
      tenantId:  ctx.tenantId,
      createdAt: new Date(),
      expiresAt,
      accepted:  false,
    });

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "https://app.shootflow.com";
  const inviteUrl = `${appUrl}/join/${token}`;

  // Send invite email
  try {
    await resend.emails.send({
      from:    "ShootFlow <noreply@shootflow.com>",
      to:      email,
      subject: `${company} invited you to join their photography team`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px;">
          <h2 style="color: #0b2a55; margin-bottom: 8px;">You've been invited!</h2>
          <p style="color: #555; margin-bottom: 24px;">
            <strong>${company}</strong> has invited you to join their team on ShootFlow —
            a platform to manage your shoots, schedule, and deliverables.
          </p>
          <a href="${inviteUrl}"
            style="display: inline-block; background: #0b2a55; color: white; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Accept Invitation
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            This link expires in 7 days. If you weren't expecting this invite, you can ignore this email.
          </p>
          <p style="color: #ccc; font-size: 11px; margin-top: 8px;">
            Direct link: ${inviteUrl}
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Don't fail the whole request if email fails — return the link instead
    return Response.json({ ok: true, inviteUrl, emailFailed: true });
  }

  return Response.json({ ok: true });
}
