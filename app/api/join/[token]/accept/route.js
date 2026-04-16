import { adminDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

export async function POST(req, { params }) {
  const { token } = params;
  const { name, phone, email } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }

  // Find the invite across all tenants by doc ID
  let inviteRef = null;
  let tenantId  = null;

  try {
    const snap = await adminDb.collectionGroup("invites").get();
    for (const doc of snap.docs) {
      if (doc.id === token) {
        inviteRef = doc.ref;
        tenantId  = doc.ref.parent.parent.id;
        const data = doc.data();
        if (data.accepted) {
          return Response.json({ error: "This invite has already been used." }, { status: 400 });
        }
        const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
        if (expiresAt < new Date()) {
          return Response.json({ error: "This invite has expired." }, { status: 400 });
        }
        break;
      }
    }
  } catch (err) {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  if (!inviteRef || !tenantId) {
    return Response.json({ error: "Invite not found." }, { status: 404 });
  }

  // Create team member
  const memberId = uuidv4();
  const member = {
    id:            memberId,
    name:          name.trim(),
    email:         email?.trim() || "",
    phone:         phone?.trim() || "",
    skills:        [],
    active:        true,
    joinedViaInvite: true,
    joinedAt:      new Date(),
    calendarToken: uuidv4(),
  };

  await adminDb
    .collection("tenants").doc(tenantId)
    .collection("teamMembers").doc(memberId)
    .set(member);

  // Mark invite as accepted
  await inviteRef.update({ accepted: true, acceptedAt: new Date(), memberId });

  return Response.json({ ok: true, memberId });
}
