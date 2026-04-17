import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import PropertyWebsiteClient from "./PropertyWebsiteClient";

export async function generateMetadata({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return {};
  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(params.bookingId)
    .get();
  if (!bookingDoc.exists) return {};
  const booking = bookingDoc.data();
  const pw = booking.propertyWebsite;
  if (!pw?.published) return {};
  const address = pw.customName || pw.address || booking.fullAddress || booking.address || "Property";
  const biz = tenant.branding?.businessName || tenant.businessName;
  return {
    title: `${address} | ${biz}`,
    description: pw.description?.slice(0, 160) || `View photos and details for ${address}`,
    openGraph: {
      title: address,
      images: pw.heroImageUrl ? [{ url: pw.heroImageUrl }] : [],
    },
  };
}

export default async function PropertyWebsitePage({ params }) {
  let tenant;
  try {
    tenant = await getTenantBySlug(params.slug);
  } catch (err) {
    console.error("[property page] tenant lookup error:", err);
  }
  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/60 text-lg">Property listing not found.</p>
      </div>
    );
  }

  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(params.bookingId)
    .get();

  if (!bookingDoc.exists) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white/60 text-lg">Listing not found.</p>
      </div>
    );
  }
  const booking = bookingDoc.data();
  const pw = booking.propertyWebsite;

  if (!pw?.published) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 text-lg">This property page is not yet available.</p>
          <p className="text-white/30 text-sm mt-2">Please check back later.</p>
        </div>
      </div>
    );
  }

  // Fetch gallery
  let galleryMedia = [];
  if (booking.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(booking.galleryId)
      .get();
    if (galleryDoc.exists) {
      const gallery = galleryDoc.data();
      const showAll = gallery.unlocked || pw.showUnlocked;
      const allMedia = gallery.media || [];
      const images = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
      const videos = allMedia.filter((m) => m.fileType?.startsWith("video/"));
      const previewCount = pw.previewCount || 12;
      const rawMedia = [
        ...(showAll ? images : images.slice(0, previewCount)),
        ...(showAll ? videos : videos.slice(0, 1)),
      ];
      // Sanitize — strip any non-serializable Firestore values
      galleryMedia = rawMedia.map((m) => ({
        url:      m.url      || null,
        fileName: m.fileName || null,
        fileType: m.fileType || null,
        key:      m.key      || null,
        width:    m.width    || null,
        height:   m.height   || null,
      }));
    }
  }

  const branding = {
    primary:  tenant.branding?.primaryColor  || "#0b2a55",
    accent:   tenant.branding?.accentColor   || "#c9a96e",
    bizName:  tenant.branding?.businessName  || tenant.businessName || "",
    tagline:  tenant.branding?.tagline       || "",
    logo:     tenant.branding?.logoUrl       || null,
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
      bookingId={params.bookingId}
      tenantSlug={params.slug}
    />
  );
}
