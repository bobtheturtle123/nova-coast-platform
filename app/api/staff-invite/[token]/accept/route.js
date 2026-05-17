import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { safeDate } from "@/lib/dateUtils";

export async function POST(req, { params }) {
  const { token } = params;

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  const { uid, email } = body;
  if (!uid) return Response.json({ error: "uid required" }, { status: 400 });

  // O(1) lookup via top-level token index (written at invite creation time)
  let tenantId;
  try {
    const tokenDoc = await adminDb.collection("staffInviteTokens").doc(token).get();
    if (!tokenDoc.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
    tenantId = tokenDoc.data().tenantId;
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  const inviteRef  = adminDb.collection("tenants").doc(tenantId).collection("staffInvites").doc(token);
  let inviteData;
  try {
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
    inviteData = inviteDoc.data();
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
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

  await adminAuth.setCustomUserClaims(uid, {
    role,
    tenantId,
    memberId,
  });

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
