import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

// Let the agent hand-pick and order the photos used on their listing's print
// brochure. Stored as propertyWebsite.brochureImageKeys (ordered media keys);
// an empty array restores the default "first photos in gallery order" behavior.
export async function POST(req, { params }) {
  try {
    const { token, bookingId, brochureImageKeys } = await req.json();
    if (!token || !bookingId || !Array.isArray(brochureImageKeys)) {
      return Response.json({ error: "token, bookingId, and brochureImageKeys are required." }, { status: 400 });
    }

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found." }, { status: 404 });

    // Validate agent token
    const agentsSnap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("agents")
      .where("accessToken", "==", token)
      .limit(1)
      .get();
    if (agentsSnap.empty) return Response.json({ error: "Unauthorized." }, { status: 401 });
    const agent = agentsSnap.docs[0].data();

    // Verify booking belongs to this agent
    const bookingRef = adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) return Response.json({ error: "Booking not found." }, { status: 404 });
    const bookingData = bookingDoc.data();
    if (bookingData.clientEmail?.toLowerCase() !== agent.email?.toLowerCase()) {
      return Response.json({ error: "Unauthorized." }, { status: 403 });
    }
    if (!bookingData.propertyWebsite) {
      return Response.json({ error: "Property website isn't set up for this listing yet." }, { status: 400 });
    }

    // Keep only valid string keys that actually exist in this gallery's media,
    // capped to the brochure's usable count. Dot-path update preserves the rest
    // of the propertyWebsite object.
    let validKeys = brochureImageKeys.filter((k) => typeof k === "string" && k).slice(0, 9);
    if (validKeys.length && bookingData.galleryId) {
      try {
        const galDoc = await adminDb
          .collection("tenants").doc(tenant.id)
          .collection("galleries").doc(bookingData.galleryId)
          .get();
        if (galDoc.exists) {
          const mediaKeys = new Set((galDoc.data().media || []).map((m) => m.key).filter(Boolean));
          validKeys = validKeys.filter((k) => mediaKeys.has(k));
        }
      } catch { /* non-fatal — fall through with the provided keys */ }
    }

    await bookingRef.update({
      "propertyWebsite.brochureImageKeys": validKeys,
      updatedAt: new Date(),
    });

    return Response.json({ ok: true, brochureImageKeys: validKeys });
  } catch (err) {
    console.error("[agent/brochure] error:", err);
    return Response.json({ error: "Failed to save brochure photos." }, { status: 500 });
  }
}
