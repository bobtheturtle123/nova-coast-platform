import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { safeDate } from "@/lib/dateUtils";

export async function POST(req, { params }) {
  const { token } = params;

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const { uid, email } = body;
  if (!uid) return Response.json({ error: "uid required" }, { status: 400 });

  // Find the invite across all tenants
  let inviteRef  = null;
  let tenantId   = null;
  let inviteData = null;

  try {
    const snap = await adminDb.collectionGroup("staffInvites").get();
    for (const doc of snap.docs) {
      if (doc.id === token) {
        inviteRef  = doc.ref;
        tenantId   = doc.ref.parent.parent.id;
        inviteData = doc.data();
        break;
      }
    }
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  if (!inviteRef || !tenantId || !inviteData) {
    return Response.json({ error: "Invite not found." }, { status: 404 });
  }
  if (inviteData.accepted) {
    return Response.json({ error: "This invite has already been used." }, { status: 400 });
  }
  const expiresAt = safeDate(inviteData.expiresAt);
  if (!expiresAt || expiresAt < new Date()) {
    return Response.json({ error: "This invite has expired." }, { status: 400 });
  }

  // Set custom claims on the Firebase user
  await adminAuth.setCustomUserClaims(uid, {
    role:     inviteData.role || "manager",
    tenantId,
  });

  // Mark invite accepted
  await inviteRef.update({ accepted: true, acceptedAt: new Date(), uid, email: email || inviteData.email });

  return Response.json({ ok: true, tenantId, role: inviteData.role || "manager" });
}
