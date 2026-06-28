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

// DELETE — the member deactivates (closes) their own profile. Sets active:false
// and revokes their login so they can no longer access the account.
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const ref = memberRef(ctx);
  if (!ref) return Response.json({ error: "Owners can't deactivate from here." }, { status: 400 });
  try {
    await ref.update({ active: false, deactivatedAt: new Date(), deactivatedSelf: true });
    if (ctx.uid) {
      try { await adminAuth.setCustomUserClaims(ctx.uid, {}); } catch {}
      try { await adminAuth.revokeRefreshTokens(ctx.uid); } catch {}
    }
  } catch (e) {
    return Response.json({ error: "Could not deactivate." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
