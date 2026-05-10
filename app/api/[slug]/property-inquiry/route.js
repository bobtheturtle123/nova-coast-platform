import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";
import { Resend } from "resend";
import { rateLimit, stripTags } from "@/lib/rateLimit";

// POST /api/[slug]/property-inquiry
// Contact form submission from a property website
export async function POST(req, { params }) {
  const rl = await rateLimit(req, `property-inquiry:${params.slug}`, 10, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const name    = stripTags(String(body.name    || "")).slice(0, 100);
    const email   = String(body.email   || "").toLowerCase().trim().slice(0, 200);
    const phone   = String(body.phone   || "").replace(/[^0-9+\-().x ]/g, "").slice(0, 30);
    const message = stripTags(String(body.message || "")).slice(0, 2000);
    const bookingId = body.bookingId ? String(body.bookingId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : null;
    const address = stripTags(String(body.address || "")).slice(0, 300);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !emailRegex.test(email) || !message) {
      return Response.json({ error: "Name, email, and message required" }, { status: 400 });
    }

    // Get the booking to find agent email
    let agentEmail = null;
    if (bookingId) {
      const doc = await adminDb
        .collection("tenants").doc(tenant.id)
        .collection("bookings").doc(bookingId)
        .get();
      if (doc.exists) {
        const b = doc.data();
        agentEmail = b.propertyWebsite?.agentEmail || b.clientEmail || null;
      }
    }

    // Save inquiry to Firestore
    await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("propertyInquiries")
      .add({
        bookingId:  bookingId || null,
        address:    address || "",
        name,
        email,
        phone:      phone || "",
        message,
        createdAt:  new Date(),
        read:       false,
      });

    // Send email notification
    if (process.env.RESEND_API_KEY && agentEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    `${tenant.businessName || "Property Inquiry"} <noreply@mail.kyoriaos.com>`,
        to:      agentEmail,
        subject: `New inquiry: ${address || "Property listing"}`,
        html: `
          <p><strong>New property inquiry from ${name}</strong></p>
          <p><strong>Property:</strong> ${address}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
          <p><strong>Message:</strong><br>${message.replace(/\n/g, "<br>")}</p>
        `.trim(),
      }).catch((e) => console.error("Inquiry email failed:", e));
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Property inquiry error:", err);
    return Response.json({ error: "Failed to send" }, { status: 500 });
  }
}
