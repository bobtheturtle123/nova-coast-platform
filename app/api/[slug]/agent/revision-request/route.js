import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { getAppUrl } from "@/lib/appUrl";

export async function POST(req, { params }) {
  try {
    const { token, bookingId, message, mediaItems = [] } = await req.json();
    if (!token || !bookingId || !message?.trim()) {
      return Response.json({ error: "token, bookingId, and message are required." }, { status: 400 });
    }

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found." }, { status: 404 });

    // Check that revision requests are enabled for this tenant
    const allowRevisions = tenant.bookingConfig?.allowRevisionRequests;
    if (!allowRevisions) {
      return Response.json({ error: "Revision requests are not enabled." }, { status: 403 });
    }

    // Validate agent token
    const agentsSnap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("agents")
      .where("accessToken", "==", token)
      .limit(1)
      .get();
    if (agentsSnap.empty) return Response.json({ error: "Unauthorized." }, { status: 401 });
    const agent = agentsSnap.docs[0].data();

    // Verify booking belongs to this agent
    const bookingDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(bookingId)
      .get();
    if (!bookingDoc.exists) return Response.json({ error: "Booking not found." }, { status: 404 });
    const bookingData = bookingDoc.data();
    if (bookingData.clientEmail?.toLowerCase() !== agent.email?.toLowerCase()) {
      return Response.json({ error: "Unauthorized." }, { status: 403 });
    }

    const revisionId  = adminDb.collection("tmp").doc().id;
    const revisionRef = adminDb
      .collection("tenants").doc(tenant.id)
      .collection("revisionRequests").doc(revisionId);

    await revisionRef.set({
      id:          revisionId,
      bookingId,
      galleryId:   bookingData.galleryId || null,
      agentEmail:  agent.email,
      agentName:   agent.name || "",
      requestedAt: new Date(),
      status:      "pending",
      message:     message.trim().slice(0, 2000),
      mediaItems:  mediaItems.slice(0, 20),
      adminNotes:  "",
      resolvedAt:  null,
    });

    // Notify admin (fire-and-forget) — respects team_revision_request notification preference
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const notifPref = tenant.notificationPrefs?.team_revision_request;
      const emailEnabled = notifPref?.channels?.email !== false;
      if (resendKey && tenant.email && emailEnabled) {
        const { Resend } = await import("resend");
        const resend   = new Resend(resendKey);
        const primary  = tenant.branding?.primaryColor || "#3486cf";
        const bizName  = tenant.branding?.businessName || "KyoriaOS";
        const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
        const from     = `${bizName} <${fromEmail}>`;
        await resend.emails.send({
          from, to: [tenant.email],
          subject: `Revision Request — ${bookingData.fullAddress || bookingData.address}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
            <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 8px">New Revision Request</h2>
            <p style="color:#555;margin:0 0 20px">From <strong>${agent.name} (${agent.email})</strong> for <strong>${bookingData.fullAddress || bookingData.address}</strong></p>
            <blockquote style="border-left:3px solid ${primary};padding-left:16px;color:#444;margin:0 0 20px;font-style:italic">${message.trim()}</blockquote>
            <a href="${getAppUrl()}/dashboard/revisions" style="background:${primary};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              View in Dashboard →
            </a>
          </div>`,
        })
          .then(() => console.log("[email] revision request notification sent to", tenant.email))
          .catch((e) => console.error("[email] revision request notification FAILED:", e?.message || e));
      }
    } catch (e) { console.error("[email] revision request notification error (non-fatal):", e?.message); }

    return Response.json({ ok: true, revisionId });
  } catch (err) {
    console.error("Revision request error:", err);
    return Response.json({ error: "Failed to submit revision request." }, { status: 500 });
  }
}
