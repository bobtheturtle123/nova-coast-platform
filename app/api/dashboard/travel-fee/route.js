import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTravelFee } from "@/lib/travelFee";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { address, lat, lng, photographerId } = await req.json();
    if (!address) return Response.json({ travelFee: 0, miles: 0, withinRange: true });

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data() || {};
    const tfConfig  = tenant.travelFeeConfig || {};

    // If usePhotographerZip is on and a photographerId was passed, use their homeZip
    let fromZip = tenant.fromZip || process.env.NEXT_PUBLIC_FROM_ZIP || "90210";
    if (tfConfig.usePhotographerZip && photographerId) {
      const memberDoc = await adminDb
        .collection("tenants").doc(ctx.tenantId)
        .collection("team").doc(photographerId).get();
      const memberZip = memberDoc.exists ? memberDoc.data()?.homeZip : null;
      if (memberZip) fromZip = memberZip;
    }

    const config = {
      ...tfConfig,
      ...(lat != null && lng != null ? { destLat: lat, destLng: lng } : {}),
    };

    const result = await getTravelFee(fromZip, address, config);
    return Response.json({ travelFee: result.fee, miles: result.miles, withinRange: result.withinRange });
  } catch (err) {
    console.error("[dashboard/travel-fee]", err);
    return Response.json({ travelFee: 0, miles: 0, withinRange: true });
  }
}
