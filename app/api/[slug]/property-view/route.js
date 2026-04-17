import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// POST /api/[slug]/property-view
// Called on page load to increment view counter (fire-and-forget)
export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ ok: false }, { status: 404 });

    const { bookingId } = await req.json();
    if (!bookingId) return Response.json({ ok: false }, { status: 400 });

    await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(bookingId)
      .update({
        "propertyWebsite.viewCount":    FieldValue.increment(1),
        "propertyWebsite.lastViewedAt": FieldValue.serverTimestamp(),
      });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
