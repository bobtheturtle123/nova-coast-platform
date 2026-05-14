import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtxAndMemberId(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;

    const teamRef = adminDb.collection("tenants").doc(decoded.tenantId).collection("team");
    let memberId = decoded.memberId;

    if (!memberId) {
      const field = decoded.uid ? "uid" : "email";
      const val   = decoded.uid ? decoded.uid : decoded.email?.toLowerCase();
      if (!val) return null;
      const snap = await teamRef.where(field, "==", val).limit(1).get();
      if (snap.empty) return null;
      memberId = snap.docs[0].id;
    }

    return { tenantId: decoded.tenantId, memberId };
  } catch { return null; }
}

export async function DELETE(req) {
  const ctx = await getCtxAndMemberId(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(ctx.memberId)
    .update({ googleCalendar: {} });

  return Response.json({ ok: true });
}
