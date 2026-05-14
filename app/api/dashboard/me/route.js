import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid, email: decoded.email, memberId: decoded.memberId };
  } catch { return null; }
}

async function findMemberDoc(ctx) {
  const teamRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team");

  if (ctx.memberId) {
    const doc = await teamRef.doc(ctx.memberId).get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
  }
  if (ctx.uid) {
    const snap = await teamRef.where("uid", "==", ctx.uid).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  if (ctx.email) {
    const snap = await teamRef.where("email", "==", ctx.email.toLowerCase()).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const member = await findMemberDoc(ctx);
  if (!member) return Response.json({ member: null, isOwner: true });

  return Response.json({ member });
}

const VALID_PREF_KEYS = ["readAvailability", "writeBookings", "syncBlocks"];

export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const member = await findMemberDoc(ctx);
  if (!member) return Response.json({ error: "Member not found" }, { status: 404 });

  const update = {};
  if (body.calendarPrefs && typeof body.calendarPrefs === "object") {
    update.calendarPrefs = Object.fromEntries(
      VALID_PREF_KEYS.map((k) => [k, !!body.calendarPrefs[k]])
    );
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: "No valid fields" }, { status: 400 });
  }

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(member.id)
    .update(update);

  return Response.json({ ok: true });
}
