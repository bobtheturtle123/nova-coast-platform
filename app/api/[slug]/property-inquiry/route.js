import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";
import { Resend } from "resend";

// POST /api/[slug]/property-inquiry
// Contact form submission from a property website
export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    const { name, email, phone, message, bookingId, address } = await req.json();
    if (!name || !email || !message) {
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
        from:    `${tenant.businessName || "Property Inquiry"} <noreply@${process.env.RESEND_FROM_DOMAIN || "notifications.novaos.com"}>`,
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
