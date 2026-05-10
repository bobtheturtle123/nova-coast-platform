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

  const { searchParams } = new URL(req.url);
  const PAGE_SIZE  = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const afterParam = searchParams.get("after"); // ISO string of last doc's createdAt (cursor)

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  // Build paginated bookings query — fetch PAGE_SIZE + 1 to detect hasMore
  let bookingsQuery = tenantRef
    .collection("bookings")
    .orderBy("createdAt", "desc")
    .limit(PAGE_SIZE + 1);

  if (afterParam) {
    bookingsQuery = bookingsQuery.startAfter(new Date(afterParam));
  }

  // Run bookings query and a gallery fetch in parallel
  // Galleries limited to same window — covers the returned bookings
  const [bookingSnap, gallerySnap] = await Promise.all([
    bookingsQuery.get(),
    tenantRef.collection("galleries").orderBy("createdAt", "desc").limit(PAGE_SIZE + 50).get(),
  ]);

  // Determine if there is a next page
  const hasMore = bookingSnap.docs.length > PAGE_SIZE;
  const docs    = hasMore ? bookingSnap.docs.slice(0, PAGE_SIZE) : bookingSnap.docs;

  // Cursor is the createdAt of the last returned doc (for next page request)
  const lastDoc     = docs[docs.length - 1];
  const lastCreated = lastDoc?.data().createdAt;
  const nextCursor  = lastCreated
    ? (lastCreated.toDate ? lastCreated.toDate().toISOString() : new Date(lastCreated).toISOString())
    : null;

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

  const listings = docs
    .filter((doc) => doc.data().isListing !== false)
    .map((doc) => {
      const b = serialize(doc.data());
      return {
        id:           doc.id,
        clientName:   b.clientName   || "",
        clientEmail:  b.clientEmail  || "",
        clientPhone:  b.clientPhone  || "",
        address:      b.address      || "",
        fullAddress:  b.fullAddress  || b.address || "",
        city:         b.city         || "",
        state:        b.state        || "",
        squareFootage:b.squareFootage|| "",
        propertyType: b.propertyType || "",
        status:       b.status       || "pending_payment",
        shootDate:    b.shootDate    || b.preferredDate || null,
        preferredDate:b.preferredDate|| null,
        totalPrice:       b.totalPrice       || 0,
        depositAmount:    b.depositAmount    || 0,
        remainingBalance: b.remainingBalance || 0,
        depositPaid:  b.depositPaid  || false,
        balancePaid:  b.balancePaid  || false,
        paidInFull:   b.paidInFull   || false,
        packageId:   b.packageId  || null,
        serviceIds:  b.serviceIds || [],
        addonIds:    b.addonIds   || [],
        createdAt:   b.createdAt  || null,
        galleryId:   b.galleryId  || null,
        gallery:     galleryMap[doc.id] || null,
      };
    });

  return Response.json({ listings, hasMore, nextCursor });
}
