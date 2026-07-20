import { adminDb } from "@/lib/firebase-admin";

// Resolves "who did this" for activity-log entries, so the Activity tab can show
// which team member sent a delivery/invoice instead of an anonymous event.
//
// ctx: { tenantId, uid, email, memberId } — as decoded from the ID token.
// Returns { id, name, role } — never throws; falls back to the account email,
// then "Owner" (a tenant owner has no tenants/{id}/team doc, same assumption
// /api/dashboard/me makes when it returns isOwner: true).
export async function resolveActor(ctx = {}) {
  const fallback = { id: ctx.uid || null, name: ctx.email || "Owner", role: "owner" };
  if (!ctx.tenantId) return fallback;

  try {
    const teamRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team");

    let doc = null;
    if (ctx.memberId) {
      const d = await teamRef.doc(ctx.memberId).get();
      if (d.exists) doc = { id: d.id, ...d.data() };
    }
    if (!doc && ctx.uid) {
      const s = await teamRef.where("uid", "==", ctx.uid).limit(1).get();
      if (!s.empty) doc = { id: s.docs[0].id, ...s.docs[0].data() };
    }
    if (!doc && ctx.email) {
      const s = await teamRef.where("email", "==", ctx.email.toLowerCase()).limit(1).get();
      if (!s.empty) doc = { id: s.docs[0].id, ...s.docs[0].data() };
    }
    if (!doc) return fallback;

    return {
      id:   doc.id,
      name: doc.name || doc.email || fallback.name,
      role: doc.customRoleTitle || doc.role || null,
    };
  } catch {
    return fallback;
  }
}

// Human label for an activity row: "Dana Reed (manager)".
export function actorLabel(actor) {
  if (!actor?.name) return null;
  return actor.role ? `${actor.name} (${actor.role})` : actor.name;
}
