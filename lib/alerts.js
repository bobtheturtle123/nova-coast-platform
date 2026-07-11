import { adminDb } from "@/lib/firebase-admin";

// Critical superadmin alerts for payment-routing failures. Written to the
// _criticalAlerts collection (superadmin-only surface) and emailed to the
// platform alert address. Never includes secrets.
export async function sendCriticalAlert({
  type,            // e.g. "payment_routing_mismatch", "platform_only_payment"
  tenantId = null,
  bookingId = null,
  paymentId = null,
  expected = null, // expected routing (acct id / fee)
  actual = null,   // actual routing observed
  amountCents = null,
  message = "",
}) {
  const alert = {
    type, tenantId, bookingId, paymentId,
    expected, actual, amountCents,
    message: String(message).slice(0, 1000),
    createdAt: new Date(),      // UTC
    acknowledged: false,
  };
  try {
    await adminDb.collection("_criticalAlerts").add(alert);
  } catch (e) {
    console.error("[sendCriticalAlert] firestore write failed:", e?.message);
  }
  console.error(`[CRITICAL ALERT] ${type} tenant=${tenantId} booking=${bookingId} payment=${paymentId} — ${message}`);
  try {
    const key = process.env.RESEND_API_KEY;
    const to  = process.env.ALERT_EMAIL || "complexdesign123@gmail.com";
    if (key) {
      const { Resend } = await import("resend");
      await new Resend(key).emails.send({
        from: `KyoriaOS Alerts <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
        to,
        subject: `[CRITICAL] ${type} — tenant ${tenantId || "?"}`,
        html: `<div style="font-family:monospace;max-width:640px;margin:0 auto;padding:24px">
          <h2 style="color:#dc2626">Critical payment alert: ${type}</h2>
          <table style="font-size:13px">
            <tr><td>Tenant</td><td>${tenantId || "—"}</td></tr>
            <tr><td>Booking</td><td>${bookingId || "—"}</td></tr>
            <tr><td>Payment</td><td>${paymentId || "—"}</td></tr>
            <tr><td>Amount</td><td>${amountCents != null ? `$${(amountCents / 100).toFixed(2)}` : "—"}</td></tr>
            <tr><td>Expected</td><td>${expected ? JSON.stringify(expected) : "—"}</td></tr>
            <tr><td>Actual</td><td>${actual ? JSON.stringify(actual) : "—"}</td></tr>
            <tr><td>UTC</td><td>${new Date().toISOString()}</td></tr>
          </table>
          <p style="font-size:13px">${String(message).slice(0, 500)}</p>
        </div>`,
      }).catch(() => {});
    }
  } catch { /* alert email is best-effort; Firestore + logs already have it */ }
}
