import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { resolveActor } from "@/lib/actor";
import { sendAgreementForSigning } from "@/lib/agreement";

export const dynamic = "force-dynamic";

// Send / resend the service agreement for signing, or send a reminder — triggered
// from the listing page when a booking's agreement is still unsigned. This is the
// authed (tenant-side) counterpart to the public /api/[slug]/agreement/[bookingId]
// route the client uses to sign.
//
// body: { action: "send" | "resend" | "remind" }
//   send / resend → fresh signing email
//   remind        → reminder-worded email (blocked once already signed)

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return {
      tenantId: decoded.tenantId,
      uid:      decoded.uid,
      email:    decoded.email,
      memberId: decoded.memberId,
    };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => ({}));
  const remind = body.action === "remind";

  const ref  = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Booking not found" }, { status: 404 });
  const booking = { id: snap.id, ...snap.data() };

  if (booking.contractSigned) {
    return Response.json({ error: "This agreement has already been signed." }, { status: 409 });
  }
  if (!booking.clientEmail) {
    return Response.json({ error: "This booking has no client email on file." }, { status: 400 });
  }

  const tenant = await getTenantById(ctx.tenantId);
  const agreementText = booking.contractText || tenant?.bookingConfig?.serviceAgreement?.text;
  if (!agreementText) {
    return Response.json({ error: "No service agreement is set up in Settings." }, { status: 400 });
  }

  const actor = await resolveActor(ctx);
  const r = await sendAgreementForSigning({
    tenantId: ctx.tenantId,
    tenant,
    booking,
    bookingId: params.id,
    agreementText,
    reminder: remind,
    actor,
  });

  if (!r.ok) return Response.json({ error: r.reason || "Failed to send agreement." }, { status: 400 });
  return Response.json({ ok: true, signUrl: r.signUrl, reminded: remind });
}
