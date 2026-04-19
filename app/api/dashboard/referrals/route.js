import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [tenantDoc, referralsSnap] = await Promise.all([
    adminDb.collection("tenants").doc(ctx.tenantId).get(),
    adminDb
      .collection("referrals")
      .where("referrerId", "==", ctx.tenantId)
      .orderBy("signedUpAt", "desc")
      .limit(50)
      .get(),
  ]);

  if (!tenantDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const tenant = tenantDoc.data();

  const referrals = referralsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id:            d.id,
      refereeEmail:  data.refereeEmail,
      status:        data.status,
      blockedReason: data.blockedReason || null,
      signedUpAt:    data.signedUpAt?.toDate?.()?.toISOString() || null,
      rewardedAt:    data.rewardedAt?.toDate?.()?.toISOString()  || null,
    };
  });

  return Response.json({
    referralCode:   tenant.referralCode || null,
    creditsCents:   tenant.referralCredits || 0,
    referrals,
    totalRewarded:  referrals.filter((r) => r.status === "rewarded").length,
    totalPending:   referrals.filter((r) => r.status === "pending").length,
  });
}
