import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { notFound, redirect } from "next/navigation";
import PropertyWebsiteClient from "@/app/[slug]/property/[bookingId]/PropertyWebsiteClient";

// This page handles requests coming in on custom domains.
// The middleware rewrites /custom-domain/* requests and sets the
// x-custom-domain header with the original hostname.

export default async function CustomDomainPage({ params }) {
  const headersList = await headers();
  const customDomain = headersList.get("x-custom-domain");

  if (!customDomain) notFound();

  // Look up tenant by custom domain
  const tenantsSnap = await adminDb.collection("tenants")
    .where("customDomain.domain", "==", customDomain.toLowerCase())
    .limit(1)
    .get();

  if (tenantsSnap.empty) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-6">
        <div>
          <p className="text-white/60 text-lg mb-2">Domain not configured</p>
          <p className="text-white/30 text-sm">
            This domain hasn't been connected to a property listing yet.
          </p>
        </div>
      </div>
    );
  }

  const tenantDoc = tenantsSnap.docs[0];
  const tenant    = { id: tenantDoc.id, ...tenantDoc.data() };

  // The path after the domain maps to optional /[bookingId]
  // Default: redirect to the default listing if set, or show a landing
  const pathSegments = (params?.path || []).filter(Boolean);
  const bookingId    = pathSegments[0] || tenant.customDomain?.defaultBookingId;

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-6">
        <div>
          <p className="text-white/60 text-lg mb-2">{tenant.businessName || "Property Listing"}</p>
          <p className="text-white/30 text-sm">No listing specified.</p>
        </div>
      </div>
    );
  }

  // Fetch booking + gallery (same logic as the regular property page)
  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(bookingId)
    .get();

  if (!bookingDoc.exists) notFound();

  const booking = bookingDoc.data();
  const pw      = booking.propertyWebsite;

  if (!pw?.published) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/60">This property page is not yet available.</p>
      </div>
    );
  }

  let galleryMedia = [];
  if (booking.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(booking.galleryId)
      .get();
    if (galleryDoc.exists) {
      const gallery    = galleryDoc.data();
      const showAll    = gallery.unlocked || pw.showUnlocked;
      const allMedia   = gallery.media || [];
      const images     = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
      const videos     = allMedia.filter((m) => m.fileType?.startsWith("video/"));
      const previewCount = pw.previewCount || 12;
      galleryMedia = [
        ...(showAll ? images : images.slice(0, previewCount)),
        ...(showAll ? videos : videos.slice(0, 1)),
      ];
    }
  }

  const branding = {
    primary: tenant.branding?.primaryColor  || "#0b2a55",
    accent:  tenant.branding?.accentColor   || "#c9a96e",
    bizName: tenant.branding?.businessName  || tenant.businessName || "",
    tagline: tenant.branding?.tagline       || "",
    logo:    tenant.branding?.logoUrl       || null,
  };

  return (
    <PropertyWebsiteClient
      pw={pw}
      booking={{
        fullAddress: booking.fullAddress,
        address:     booking.address,
        clientName:  booking.clientName,
        clientEmail: booking.clientEmail,
      }}
      galleryMedia={galleryMedia}
      branding={branding}
      bookingId={bookingId}
      tenantSlug={tenant.slug}
    />
  );
}
