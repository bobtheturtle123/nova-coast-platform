import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { getListingLimit } from "@/lib/plans";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) return Response.json({ error: "Booking not found" }, { status: 404 });
  if (bookingDoc.data().isListing === true) return Response.json({ ok: true, alreadyListing: true });

  // Enforce listing credit limit — count active listing workspaces
  const tenant = await getTenantById(ctx.tenantId);
  if (tenant) {
    const limit = getListingLimit(
      tenant.subscriptionPlan || "solo",
      tenant.addonListings || 0
    );
    // Count all non-cancelled bookings that are active listing workspaces
    // (isListing: true, or isListing undefined = legacy bookings created before this feature)
    const allActiveSnap = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("bookings")
      .where("status", "!=", "cancelled")
      .get();
    const listingCount = allActiveSnap.docs.filter(
      (d) => d.data().isListing !== false
    ).length;

    if (listingCount >= limit) {
      return Response.json(
        { error: `Listing workspace limit reached (${limit} on your plan). Archive completed listings or upgrade to add more.` },
        { status: 403 }
      );
    }
  }

  await bookingRef.update({ isListing: true });
  return Response.json({ ok: true });
}
