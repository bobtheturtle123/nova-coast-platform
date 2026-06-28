export const dynamic = "force-dynamic";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(rawToken);
    const uid = decoded.uid;

    // 1) Owner — an existing tenant with ownerUid == uid.
    const ownerSnap = await adminDb.collection("tenants")
      .where("ownerUid", "==", uid)
      .limit(1)
      .get();

    if (!ownerSnap.empty) {
      const tenantId     = ownerSnap.docs[0].id;
      const businessName = ownerSnap.docs[0].data().businessName || "";
      await adminAuth.setCustomUserClaims(uid, { role: "owner", tenantId });
      return Response.json({ ok: true, tenantId, businessName });
    }

    // 2) Team member — restore member claims so a member whose claims were lost
    // isn't wrongly sent to company onboarding.
    // 2a) Fast path: a top-level memberAccounts/{uid} mapping (no index needed).
    try {
      const mapDoc = await adminDb.collection("memberAccounts").doc(uid).get();
      if (mapDoc.exists) {
        const { tenantId, memberId, role } = mapDoc.data();
        if (tenantId && memberId) {
          await adminAuth.setCustomUserClaims(uid, { role: role || "photographer", tenantId, memberId });
          const tDoc = await adminDb.collection("tenants").doc(tenantId).get();
          return Response.json({ ok: true, tenantId, businessName: tDoc.data()?.businessName || "" });
        }
      }
    } catch {}

    // 2b) Fallback: find their team doc by uid (then email) across tenants.
    let memberDoc = null;
    try {
      const byUid = await adminDb.collectionGroup("team").where("uid", "==", uid).limit(1).get();
      if (!byUid.empty) memberDoc = byUid.docs[0];
    } catch {}
    if (!memberDoc && decoded.email) {
      try {
        const byEmail = await adminDb.collectionGroup("team")
          .where("email", "==", decoded.email.toLowerCase()).limit(1).get();
        if (!byEmail.empty) memberDoc = byEmail.docs[0];
      } catch {}
    }

    if (memberDoc) {
      const tenantId = memberDoc.ref.parent.parent.id; // tenants/{tenantId}/team/{memberId}
      const memberId = memberDoc.id;
      const role     = memberDoc.data().role || "photographer";
      if (!memberDoc.data().uid) { try { await memberDoc.ref.update({ uid }); } catch {} }
      await adminAuth.setCustomUserClaims(uid, { role, tenantId, memberId });
      // Self-heal: write the top-level mapping so next time uses the fast path.
      adminDb.collection("memberAccounts").doc(uid).set({ tenantId, memberId, role, email: decoded.email || null }).catch(() => {});
      const tDoc = await adminDb.collection("tenants").doc(tenantId).get();
      return Response.json({ ok: true, tenantId, businessName: tDoc.data()?.businessName || "" });
    }

    return Response.json(
      { error: "No tenant found for this account. Complete onboarding first." },
      { status: 404 }
    );
  } catch (err) {
    console.error("repair-claims error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
