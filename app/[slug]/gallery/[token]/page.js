import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import GalleryClient from "./GalleryClient";

export default async function TenantGalleryPage({ params }) {
  const { slug, token } = params;
  const reqHeaders = headers();

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Find gallery by token in this tenant's subcollection
  const snap = await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("galleries")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) notFound();

  const galleryDoc = snap.docs[0];
  const gallery = { id: galleryDoc.id, ...galleryDoc.data() };

  // Fetch booking for balance info + viewer identity
  let booking = null;
  if (gallery.bookingId) {
    const bookingDoc = await adminDb
      .collection("tenants")
      .doc(tenant.id)
      .collection("bookings")
      .doc(gallery.bookingId)
      .get();
    if (bookingDoc.exists) {
      booking = { id: bookingDoc.id, ...bookingDoc.data() };
    }
  }

  // Log gallery view — respects tenant's viewer tracking preference (default: on)
  if (tenant.gallerySettings?.viewerTracking !== false) {
    const ip =
      reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      reqHeaders.get("x-real-ip") ||
      null;
    const ua = reqHeaders.get("user-agent") || null;

    adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(galleryDoc.id)
      .collection("activityLog")
      .add({
        event:       "view",
        timestamp:   new Date(),
        viewerName:  booking?.clientName  || null,
        viewerEmail: booking?.clientEmail || null,
        ip,
        userAgent:   ua,
      })
      .catch(() => {});
  }

  return (
    <GalleryClient
      gallery={JSON.parse(JSON.stringify(gallery))}
      booking={booking ? JSON.parse(JSON.stringify(booking)) : null}
      tenant={JSON.parse(JSON.stringify(tenant))}
      slug={slug}
      token={token}
    />
  );
}
