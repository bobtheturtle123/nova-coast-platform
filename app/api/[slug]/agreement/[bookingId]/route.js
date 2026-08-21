import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { logBookingActivity } from "@/lib/activityLog";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public service-agreement signing endpoint. The link the client receives is
// /{slug}/sign/{bookingId}?t={agreementToken}; the token is an unguessable
// per-booking secret, so possession of a valid token is the authorization.
//
//   GET  → load the agreement text + signed state for the signing page
//   POST → capture the signature (type-your-name), stamping the SAME contract*
//          fields an online self-booking sets, so the listing's "Signed Agreement"
//          card and Activity tab light up identically regardless of channel.

function toIso(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate().toISOString();
  try { return new Date(v).toISOString(); } catch { return null; }
}

async function resolve(slug, bookingId, token) {
  if (!slug || !bookingId || !token) return null;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return null;
  const ref  = adminDb.collection("tenants").doc(tenant.id).collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const booking = snap.data();
  // Constant work regardless of match; a missing/blank token can never validate.
  if (!booking.agreementToken || booking.agreementToken !== token) return null;
  return { tenant, ref, booking };
}

export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  const r = await resolve(params.slug, params.bookingId, token);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });

  const { tenant, booking } = r;
  const agreementText = booking.contractText || tenant.bookingConfig?.serviceAgreement?.text || "";

  return Response.json({
    businessName: tenant.branding?.businessName || tenant.businessName || tenant.name || "",
    primaryColor: tenant.branding?.primaryColor || "#3486cf",
    logoUrl:      tenant.branding?.logoUrl || null,
    clientName:   booking.clientName || "",
    address:      booking.fullAddress || booking.address || "",
    agreementText,
    signed:       !!booking.contractSigned,
    signerName:   booking.contractSignerName || null,
    signedAt:     toIso(booking.contractSignedAt),
  });
}

export async function POST(req, { params }) {
  const rl = await rateLimit(req, `agreement-sign:${params.bookingId}`, 20, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  const body       = await req.json().catch(() => ({}));
  const token      = body.token;
  const signerName = (body.signerName || "").trim();

  const r = await resolve(params.slug, params.bookingId, token);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  const { tenant, ref, booking } = r;

  // Idempotent — signing an already-signed agreement just returns the signed state.
  if (booking.contractSigned) {
    return Response.json({ ok: true, alreadySigned: true, signerName: booking.contractSignerName || null });
  }
  if (!signerName || signerName.length < 2) {
    return Response.json({ error: "Please type your full name to sign." }, { status: 400 });
  }

  const ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const now = new Date();
  const businessName = tenant.branding?.businessName || tenant.businessName || tenant.name || "Business";
  const text = booking.contractText || tenant.bookingConfig?.serviceAgreement?.text || null;

  await ref.update({
    contractSigned:          true,
    contractSignerName:      signerName,
    contractSignedAt:        now,
    contractSignerIp:        ip,
    contractText:            text,
    contractCounterSigned:   true,
    contractCounterSignedAt: now,
    contractCounterSignedBy: businessName,
    agreementSignedAt:       now,
  });

  await logBookingActivity(tenant.id, params.bookingId, {
    type:      "agreement_signed",
    title:     `Agreement signed by ${signerName}`,
    channel:   null,
    recipient: booking.clientEmail || null,
    message:   `${signerName} reviewed and signed the service agreement${ip ? ` (IP ${ip})` : ""}.`,
  }).catch(() => {});

  return Response.json({ ok: true, signerName, signedAt: now.toISOString() });
}
