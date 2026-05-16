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

  const role = inviteData.role || "manager";

  // The team member doc was created with the same ID as the invite token
  const memberId = token;

  // Set custom claims on the Firebase user (include memberId so permission lookups work)
  await adminAuth.setCustomUserClaims(uid, {
    role,
    tenantId,
    memberId,
  });

  // Mark invite accepted and record uid on the team member doc
  await Promise.all([
    inviteRef.update({ accepted: true, acceptedAt: new Date(), uid, email: email || inviteData.email }),
    adminDb.collection("tenants").doc(tenantId).collection("team").doc(memberId).update({
      uid,
      status: "active",
      acceptedAt: new Date(),
    }).catch(() => {}),
  ]);

  return Response.json({ ok: true, tenantId, role, memberId });
}
