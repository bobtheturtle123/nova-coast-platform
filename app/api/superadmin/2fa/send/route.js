import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { getSuperAdminCtx } from "@/lib/superadmin";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CODE_TTL_MIN = 10;

const hashCode = (code, uid) =>
  crypto.createHash("sha256").update(`${code}:${uid}:${process.env.CRON_SECRET || "kyoria"}`).digest("hex");

// Send a 6-digit verification code to the superadmin's email.
export async function POST(req) {
  const ctx = await getSuperAdminCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const email = ctx.email;
  if (!email) return Response.json({ error: "No email on this account." }, { status: 400 });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await adminDb.collection("superadminMfa").doc(ctx.uid).set({
    codeHash:  hashCode(code, ctx.uid),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString(),
    attempts:  0,
    sentAt:    new Date().toISOString(),
  }, { merge: true });

  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM || "KyoriaOS <noreply@kyoriaos.com>",
        to: email,
        subject: `Your KyoriaOS superadmin code: ${code}`,
        html:
          `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#0F172A">Superadmin verification</h2>
            <p style="color:#555">Use this code to access superadmin tools. It expires in ${CODE_TTL_MIN} minutes.</p>
            <p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#3486cf">${code}</p>
            <p style="color:#999;font-size:12px">If you did not request this, secure your account immediately.</p>
          </div>`,
      });
    } catch (e) {
      console.error("[superadmin/2fa/send] email failed:", e?.message);
      return Response.json({ error: "Could not send the code. Try again." }, { status: 500 });
    }
  } else {
    console.warn("[superadmin/2fa/send] RESEND not configured; code not delivered.");
    return Response.json({ error: "Email is not configured on the server." }, { status: 500 });
  }

  // Never return the code in the response.
  return Response.json({ ok: true, sentTo: email.replace(/(.{2}).*(@.*)/, "$1***$2") });
}
