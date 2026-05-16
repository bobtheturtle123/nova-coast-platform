import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { safeDate } from "@/lib/dateUtils";

export async function POST(req, { params }) {
  const { token } = params;
  const { name, phone, email, password } = await req.json();

  if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });
  if (!email?.trim()) return Response.json({ error: "Email is required." }, { status: 400 });
  if (!password || password.length < 6) return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  // Find invite via top-level index (O(1) lookup, no collectionGroup traversal)
  let inviteRef = null;
  let tenantId  = null;
  let inviteData = null;

  try {
    const doc = await adminDb.collection("photographerInvites").doc(token).get();
    if (!doc.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
    inviteRef  = doc.ref;
    tenantId   = doc.data().tenantId;
    inviteData = doc.data();
    if (inviteData.accepted) return Response.json({ error: "This invite has already been used." }, { status: 400 });
    const expiresAt = safeDate(inviteData.expiresAt);
    if (!expiresAt || expiresAt < new Date()) return Response.json({ error: "This invite has expired." }, { status: 400 });
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  if (!inviteRef || !tenantId) return Response.json({ error: "Invite not found." }, { status: 404 });

  // Create or find Firebase Auth user
  let uid;
  try {
    const existing = await adminAuth.getUserByEmail(email.trim().toLowerCase());
    uid = existing.uid;
    // Update password if they already have an account
    await adminAuth.updateUser(uid, { password });
  } catch {
    // User doesn't exist — create them
    try {
      const newUser = await adminAuth.createUser({
        email:         email.trim().toLowerCase(),
        password,
        displayName:   name.trim(),
        emailVerified: true,
      });
      uid = newUser.uid;
    } catch (err) {
      return Response.json({ error: err.message || "Could not create account." }, { status: 400 });
    }
  }

  // Create team member in the `team` subcollection
  const memberId      = uuidv4().replace(/-/g, "").slice(0, 16);
  const calendarToken = uuidv4().replace(/-/g, "");
  const memberRole    = inviteData.role || "photographer";
  const member = {
    id:              memberId,
    name:            name.trim(),
    email:           email.trim().toLowerCase(),
    phone:           phone?.trim() || "",
    role:            memberRole,
    skills:          [],
    active:          true,
    color:           "#3486cf",
    joinedViaInvite: true,
    joinedAt:        new Date(),
    calendarToken,
    uid,
    tenantId,
    payRate:         0,
    permissions:     inviteData.permissions || {},
  };

  const batch = adminDb.batch();
  batch.set(
    adminDb.collection("tenants").doc(tenantId).collection("team").doc(memberId),
    member
  );
  batch.set(
    adminDb.collection("calendarTokens").doc(calendarToken),
    { tenantId, memberId }
  );
  await batch.commit();

  // Set custom claims with role from invite
  await adminAuth.setCustomUserClaims(uid, {
    tenantId,
    memberId,
    role: memberRole,
  });

  // Mark invite accepted
  await inviteRef.update({ accepted: true, acceptedAt: new Date(), memberId, uid });

  // Generate custom token so the client can sign in immediately
  const customToken = await adminAuth.createCustomToken(uid, { tenantId, memberId, role: memberRole });

  return Response.json({ ok: true, memberId, customToken });
}
