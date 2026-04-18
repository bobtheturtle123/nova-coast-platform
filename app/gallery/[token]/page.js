import { adminDb } from "@/lib/firebase-admin";
import GalleryClient from "./GalleryClient";
import { notFound } from "next/navigation";

export default async function GalleryPage({ params }) {
  const { token } = params;
  if (!token || token.length < 20) notFound();

  // Resolve token via top-level index (no collectionGroup, no cross-tenant traversal)
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();

  let tenantId, galleryId;

  if (tokenDoc.exists) {
    // Fast path: token was registered in the index
    ({ tenantId, galleryId } = tokenDoc.data());
  } else {
    // Fallback for galleries created before the index existed:
    // Only search within one tenant — we can't know which without the index,
    // so fall through to notFound. Deploy the index migration to backfill old tokens.
    notFound();
  }

  const [galleryDoc, bookingDoc] = await Promise.all([
    adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get(),
    // We'll look up the booking after we have the gallery data
  ].concat([]));

  if (!galleryDoc.exists) notFound();

  const galleryData = galleryDoc.data();

  // Verify the stored accessToken matches the URL token (defence-in-depth)
  if (galleryData.accessToken && galleryData.accessToken !== token) notFound();

  // Fetch booking scoped to the same tenant
  const bookingSnap = galleryData.bookingId
    ? await adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(galleryData.bookingId).get()
    : null;

  const booking = bookingSnap?.exists ? bookingSnap.data() : null;

  function sanitize(val) {
    if (val === null || val === undefined) return val;
    if (val?.toDate) return val.toDate().toISOString();
    if (Array.isArray(val)) return val.map(sanitize);
    if (typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) out[k] = sanitize(v);
      return out;
    }
    return val;
  }

  return (
    <GalleryClient
      gallery={sanitize(galleryData)}
      booking={booking ? sanitize(booking) : null}
    />
  );
}
