import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, role: decoded.role || "owner", memberId: decoded.memberId || null };
  } catch { return null; }
}

function memberRef(ctx) {
  if (!ctx.memberId) return null;
  return adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId);
}

// GET — the signed-in member's own profile
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ref = memberRef(ctx);
  if (!ref) return Response.json({ member: null, isOwner: ctx.role === "owner" || ctx.role === "admin" });
  const doc = await ref.get();
  const d = doc.exists ? doc.data() : {};
  return Response.json({
    member: { id: ctx.memberId, name: d.name || "", email: d.email || "", phone: d.phone || "", role: d.role || "", active: d.active !== false },
    isOwner: ctx.role === "owner" || ctx.role === "admin",
  });
}

// PATCH — update own name/phone
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ref = memberRef(ctx);
  if (!ref) return Response.json({ error: "No member profile to update." }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const update = {};
  if (typeof body.name === "string")  update.name  = body.name.slice(0, 80);
  if (typeof body.phone === "string") update.phone = body.phone.slice(0, 40);
  if (!Object.keys(update).length) return Response.json({ error: "Nothing to update." }, { status: 400 });
  await ref.update(update);
  return Response.json({ ok: true });
}

// DELETE — the member deactivates (closes) their own profile. Marks them
// inactive and ends their session, but KEEPS their tenant/role claims so that
// signing back in returns them to their (deactivated) account — not the company
// onboarding flow. Logs a record so the owner knows it happened.
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ref = memberRef(ctx);
  if (!ref) return Response.json({ error: "Owners can't deactivate from here." }, { status: 400 });
  try {
    const snap = await ref.get();
    const name = snap.data()?.name || snap.data()?.email || "A team member";
    await ref.update({ active: false, deactivatedAt: new Date(), deactivatedSelf: true });

    // Record for the owner/admin.
    adminDb.collection("tenants").doc(ctx.tenantId).collection("teamEvents").add({
      type: "self_deactivated", memberId: ctx.memberId, name, timestamp: new Date(),
    }).catch(() => {});
    (async () => {
      try {
        const key = process.env.RESEND_API_KEY;
        if (!key) return;
        const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
        const ownerEmail = tenantDoc.data()?.email;
        if (!ownerEmail) return;
        const { Resend } = await import("resend");
        await new Resend(key).emails.send({
          from: `KyoriaOS <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
          to: ownerEmail,
          subject: `${name} deactivated their team profile`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px 24px"><p><strong>${name}</strong> deactivated their own profile. They can reactivate by signing back in, or you can manage them from your Team page.</p></div>`,
        });
      } catch {}
    })();

    // End the current session (keep claims so re-login returns to their account).
    if (ctx.uid) { try { await adminAuth.revokeRefreshTokens(ctx.uid); } catch {} }
  } catch (e) {
    return Response.json({ error: "Could not deactivate." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// POST — reactivate own profile (the deactivated member signing back in).
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ref = memberRef(ctx);
  if (!ref) return Response.json({ error: "No member profile." }, { status: 400 });
  await ref.update({ active: true, reactivatedAt: new Date(), deactivatedSelf: false });
  adminDb.collection("tenants").doc(ctx.tenantId).collection("teamEvents").add({
    type: "self_reactivated", memberId: ctx.memberId, timestamp: new Date(),
  }).catch(() => {});
  return Response.json({ ok: true });
}
