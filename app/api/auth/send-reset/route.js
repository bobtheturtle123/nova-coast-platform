import { adminAuth } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";
import { rateLimit } from "@/lib/rateLimit";

// Sends a KyoriaOS-branded password reset email via Resend instead of Firebase's
// default (which comes from noreply@<project>.firebaseapp.com and leaks the old
// "shootflow" project codename). We generate the reset oobCode with the Admin
// SDK, then link to our OWN reset page so nothing shows the Firebase domain.
export async function POST(req) {
  const rl = await rateLimit(req, "send-reset", 5, 900); // 5 / 15 min / IP
  if (rl.limited) return Response.json({ ok: true }); // don't leak rate state

  let email;
  try { ({ email } = await req.json()); } catch { return Response.json({ ok: true }); }
  email = String(email || "").trim().toLowerCase();
  // Always return ok — never reveal whether an account exists.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ ok: true });

  try {
    // Point the oobCode's continue URL at our own reset page.
    const appUrl = getAppUrl();
    const link = await adminAuth.generatePasswordResetLink(email, { url: `${appUrl}/auth/login` });

    // Extract the oobCode so we can host the reset on our own domain.
    const oob = new URL(link).searchParams.get("oobCode");
    const resetUrl = oob ? `${appUrl}/auth/reset?oobCode=${encodeURIComponent(oob)}` : link;

    const key = process.env.RESEND_API_KEY;
    if (key) {
      const { Resend } = await import("resend");
      await new Resend(key).emails.send({
        from: `KyoriaOS <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
        to: email,
        subject: "Reset your KyoriaOS password",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:36px 24px">
          <h2 style="color:#0F172A;font-family:Georgia,serif;margin:0 0 12px">Reset your password</h2>
          <p style="color:#555;margin:0 0 20px">We received a request to reset your KyoriaOS password. Click below to choose a new one. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#3486cf;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">Reset password</a>
          <p style="color:#888;font-size:12px;margin-top:22px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          <p style="color:#ccc;font-size:11px;margin-top:16px">KyoriaOS</p>
        </div>`,
      }).catch((e) => console.error("[send-reset] email failed:", e?.message));
    }
  } catch (e) {
    // auth/user-not-found etc. — stay silent to avoid account enumeration.
    if (e?.code && e.code !== "auth/user-not-found") console.error("[send-reset]", e?.message);
  }

  return Response.json({ ok: true });
}
