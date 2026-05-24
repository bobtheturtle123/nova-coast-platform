import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { Resend } from "resend";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { reason, note, applyDiscount } = await req.json();

    const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
    const tenantDoc = await tenantRef.get();
    const tenant    = tenantDoc.data();

    // Save feedback
    await adminDb.collection("churn_feedback").add({
      tenantId:        ctx.tenantId,
      businessName:    tenant?.businessName || "",
      plan:            tenant?.subscriptionPlan || "",
      reason:          reason || "",
      note:            note   || "",
      discountOffered: !!applyDiscount,
      createdAt:       new Date(),
    });

    // Notify admin by email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend     = new Resend(resendKey);
      const fromEmail  = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
      await resend.emails.send({
        from:    `KyoriaOS <${fromEmail}>`,
        to:      ["complexdesign123@gmail.com"],
        subject: `Cancellation feedback — ${tenant?.businessName || ctx.tenantId}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
          <h2 style="color:#0b2a55;margin:0 0 20px">Cancellation Feedback</h2>
          <table style="font-size:14px;border-collapse:collapse;width:100%">
            <tr><td style="padding:8px 0;color:#888;width:160px;vertical-align:top">Business</td><td style="padding:8px 0;font-weight:600">${tenant?.businessName || ctx.tenantId}</td></tr>
            <tr><td style="padding:8px 0;color:#888;vertical-align:top">Plan</td><td style="padding:8px 0">${tenant?.subscriptionPlan || "unknown"}</td></tr>
            <tr><td style="padding:8px 0;color:#888;vertical-align:top">Reason</td><td style="padding:8px 0">${reason || "Not selected"}</td></tr>
            <tr><td style="padding:8px 0;color:#888;vertical-align:top">Feedback</td><td style="padding:8px 0">${note || "None"}</td></tr>
            <tr><td style="padding:8px 0;color:#888;vertical-align:top">Discount accepted</td><td style="padding:8px 0;font-weight:600;color:${applyDiscount ? "#16a34a" : "#dc2626"}">${applyDiscount ? "Yes — $20/mo off 3 months" : "No"}</td></tr>
          </table>
        </div>`,
      }).catch(() => {});
    }

    // Apply Stripe discount if requested and not previously offered
    if (applyDiscount && !tenant?.churnDiscountOffered && tenant?.stripeSubscriptionId) {
      const coupon = await stripe.coupons.create({
        amount_off:          2000,
        currency:            "usd",
        duration:            "repeating",
        duration_in_months:  3,
        name:                "Retention discount",
      });
      await stripe.subscriptions.update(tenant.stripeSubscriptionId, { coupon: coupon.id });
      await tenantRef.update({ churnDiscountOffered: true, churnDiscountOfferedAt: new Date() });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("cancel-feedback error:", err);
    return Response.json({ error: "Failed to process" }, { status: 500 });
  }
}
