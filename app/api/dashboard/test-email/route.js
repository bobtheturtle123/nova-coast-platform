import { adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";

export async function POST(req) {
  // Verify auth
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(auth);
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return Response.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
  const toEmail = decoded.email;

  if (!toEmail) {
    return Response.json({ error: "No email on token" }, { status: 400 });
  }

  const from = `KyoriaOS <${fromEmail}>`;
  const payload = {
    from,
    to: [toEmail],
    subject: `KyoriaOS email test — ${new Date().toISOString()}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #eee;border-radius:6px">
      <h2 style="color:#3486cf;margin:0 0 16px">Email delivery confirmed</h2>
      <p style="color:#555;margin:0 0 8px">This is a platform-level test email from KyoriaOS.</p>
      <table style="font-size:13px;color:#888;border-collapse:collapse;width:100%;margin-top:16px">
        <tr><td style="padding:4px 0;width:120px">From</td><td style="padding:4px 0">${from}</td></tr>
        <tr><td style="padding:4px 0">To</td><td style="padding:4px 0">${toEmail}</td></tr>
        <tr><td style="padding:4px 0">Sent at</td><td style="padding:4px 0">${new Date().toUTCString()}</td></tr>
        <tr><td style="padding:4px 0">Env</td><td style="padding:4px 0">${process.env.VERCEL_ENV || "development"}</td></tr>
      </table>
    </div>`,
  };

  console.log("[test-email] Sending test — from:", from, "| to:", toEmail);

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("[test-email] FAILED — from:", from, "| to:", toEmail, "| error:", JSON.stringify(error));
    return Response.json({
      ok: false,
      error: error.message || JSON.stringify(error),
      from,
      to: toEmail,
      resendError: error,
    }, { status: 500 });
  }

  console.log("[test-email] OK — id:", data?.id, "| to:", toEmail);
  return Response.json({
    ok: true,
    id: data?.id,
    from,
    to: toEmail,
    sentAt: new Date().toISOString(),
  });
}
