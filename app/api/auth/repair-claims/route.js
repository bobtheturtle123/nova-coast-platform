export const dynamic = "force-dynamic";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(rawToken);
    const uid = decoded.uid;

    // Only repair claims when there is proof of ownership — an existing tenant with ownerUid == uid
    const snap = await adminDb.collection("tenants")
      .where("ownerUid", "==", uid)
      .limit(1)
      .get();

    if (snap.empty) {
      return Response.json(
        { error: "No tenant found for this account. Complete onboarding first." },
        { status: 404 }
      );
    }

    const tenantId     = snap.docs[0].id;
    const businessName = snap.docs[0].data().businessName || "";

    await adminAuth.setCustomUserClaims(uid, { role: "owner", tenantId });

    return Response.json({ ok: true, tenantId, businessName });
  } catch (err) {
    console.error("repair-claims error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
