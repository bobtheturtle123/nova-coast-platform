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

function serialize(data) {
  const out = { ...data };
  for (const key of Object.keys(out)) {
    if (out[key]?.toDate) out[key] = out[key].toDate().toISOString();
    else if (out[key]?.seconds) out[key] = new Date(out[key].seconds * 1000).toISOString();
  }
  return out;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  const { searchParams } = new URL(req.url);
  const limitParam = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  // Fetch bookings + galleries in parallel — bounded to prevent read explosion
  const [bookingSnap, gallerySnap] = await Promise.all([
    tenantRef.collection("bookings").orderBy("createdAt", "desc").limit(limitParam).get(),
    tenantRef.collection("galleries").orderBy("createdAt", "desc").limit(limitParam).get(),
  ]);

  // Build gallery map by bookingId
  const galleryMap = {};
  for (const doc of gallerySnap.docs) {
    const g = doc.data();
    if (g.bookingId) {
      galleryMap[g.bookingId] = {
        id:          doc.id,
        coverUrl:    g.media?.[0]?.url || null,
        mediaCount:  g.media?.length || 0,
        unlocked:    g.unlocked || false,
        delivered:   g.delivered || false,
        accessToken: g.accessToken || null,
      };
    }
  }

  const listings = bookingSnap.docs
    .filter((doc) => doc.data().isListing !== false)
    .map((doc) => {
    const b = serialize(doc.data());
    return {
      id:           doc.id,
      // Client / agent
      clientName:   b.clientName   || "",
      clientEmail:  b.clientEmail  || "",
      clientPhone:  b.clientPhone  || "",
      // Property
      address:      b.address      || "",
      fullAddress:  b.fullAddress  || b.address || "",
      city:         b.city         || "",
      state:        b.state        || "",
      squareFootage:b.squareFootage|| "",
      propertyType: b.propertyType || "",
      // Shoot
      status:       b.status       || "pending_payment",
      shootDate:    b.shootDate    || b.preferredDate || null,
      preferredDate:b.preferredDate|| null,
      // Pricing
      totalPrice:       b.totalPrice       || 0,
      depositAmount:    b.depositAmount    || 0,
      remainingBalance: b.remainingBalance || 0,
      depositPaid:  b.depositPaid  || false,
      balancePaid:  b.balancePaid  || false,
      paidInFull:   b.paidInFull   || false,
      // Services
      packageId:   b.packageId  || null,
      serviceIds:  b.serviceIds || [],
      addonIds:    b.addonIds   || [],
      // Timestamps
      createdAt:   b.createdAt  || null,
      // Gallery
      galleryId:   b.galleryId  || null,
      gallery:     galleryMap[doc.id] || null,
    };
  });

  return Response.json({ listings });
}
