import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { generateReferralCode } from "@/lib/referral";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — create a new named referral code
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body  = await req.json().catch(() => ({}));
  const label = (body.label || "").trim().slice(0, 48);
  if (!label) return Response.json({ error: "Label is required" }, { status: 400 });

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  if (!tenantDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const tenant     = tenantDoc.data();
  const existing   = tenant.namedReferralCodes || [];
  if (existing.length >= 10) {
    return Response.json({ error: "Maximum 10 referral codes allowed" }, { status: 400 });
  }

  const code = generateReferralCode(label);
  const entry = { code, label, createdAt: new Date().toISOString() };

  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    namedReferralCodes: [...existing, entry],
  });

  return Response.json({ ok: true, code: entry });
}

// DELETE — remove a named referral code
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return Response.json({ error: "code param required" }, { status: 400 });

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const existing  = tenantDoc.data()?.namedReferralCodes || [];
  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    namedReferralCodes: existing.filter((c) => c.code !== code),
  });

  return Response.json({ ok: true });
}
