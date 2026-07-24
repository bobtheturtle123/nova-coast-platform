import { adminDb } from "@/lib/firebase-admin";

// Emails every active team member who opted into new-order notifications
// (the notifyOnNewBooking flag) — e.g. a QC manager who wants a heads-up on
// each order. Best-effort and never throws; booking creation must not depend
// on it.
export async function notifyTeamOfNewBooking(tenantId, booking, tenant) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || !tenantId || !booking) return;

    // Single-field equality — Firestore auto-indexes this, no composite needed.
    const snap = await adminDb.collection("tenants").doc(tenantId)
      .collection("team").where("notifyOnNewBooking", "==", true).limit(50).get();

    const recipients = snap.docs
      .map((d) => d.data())
      .filter((m) => m.active !== false && m.email)
      .map((m) => m.email.toLowerCase());
    if (recipients.length === 0) return;

    const bizName   = tenant?.branding?.businessName || tenant?.businessName || "KyoriaOS";
    const primary   = tenant?.branding?.primaryColor || "#3486cf";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
    const from      = `${bizName} <${fromEmail}>`;
    const address   = booking.fullAddress || booking.address || "New property";

    const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const when = booking.shootDate
      ? `${fmtDate(booking.shootDate)}${booking.shootTime ? ` at ${booking.shootTime}` : ""}`
      : booking.preferredDate
      ? `${fmtDate(booking.preferredDate)}${booking.preferredTime ? ` · ${booking.preferredTime}` : ""}`
      : "To be scheduled";

    const row = (label, value) => value
      ? `<tr><td style="padding:7px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:34%">${label}</td>
             <td style="padding:7px 0;border-bottom:1px solid #eee;font-weight:500">${value}</td></tr>`
      : "";
    const html = `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:36px 20px">
        <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">New Order Received</h2>
        <p style="color:#555;margin:0 0 18px">A new order has come in for review.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          ${row("Property", address)}
          ${row("Client", `${booking.clientName || ""}${booking.clientPhone ? ` · ${booking.clientPhone}` : ""}`)}
          ${row("Scheduled", when)}
          ${row("Notes", booking.notes)}
        </table>
        <p style="color:#ccc;font-size:11px">${bizName} · You're receiving this because new-order notifications are enabled for your account.</p>
      </div>`;

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    await Promise.all(recipients.map((to) =>
      resend.emails.send({ from, to: [to], subject: `New order — ${address}`, html })
        .then(() => console.log("[notifyTeam] new-order email sent to", to))
        .catch((e) => console.error("[notifyTeam] send failed to", to, ":", e?.message || e))
    ));
  } catch (e) {
    console.warn("[notifyTeamOfNewBooking]", e?.message);
  }
}
