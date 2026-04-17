import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import BrochureClient from "./BrochureClient";

export async function generateMetadata({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return {};
  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(params.bookingId)
    .get();
  if (!bookingDoc.exists) return {};
  const pw = bookingDoc.data().propertyWebsite;
  const address = pw?.customName || pw?.address || "Property Brochure";
  return { title: `${address} — Brochure` };
}

export default async function BrochurePage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(params.bookingId)
    .get();
  if (!bookingDoc.exists) notFound();

  const booking = bookingDoc.data();
  const pw = booking.propertyWebsite;
  if (!pw) notFound();

  // Fetch all gallery images for the brochure
  let images = [];
  if (booking.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(booking.galleryId)
      .get();
    if (galleryDoc.exists) {
      images = (galleryDoc.data().media || [])
        .filter((m) => !m.fileType?.startsWith("video/"))
        .slice(0, 9);
    }
  }

  const branding = {
    primary: tenant.branding?.primaryColor  || "#0b2a55",
    accent:  tenant.branding?.accentColor   || "#c9a96e",
    bizName: tenant.branding?.businessName  || tenant.businessName || "",
    tagline: tenant.branding?.tagline       || "",
    logo:    tenant.branding?.logoUrl       || null,
    phone:   tenant.branding?.phone         || "",
    email:   tenant.branding?.email         || "",
    website: tenant.branding?.website       || "",
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const listingUrl = `${appUrl}/${params.slug}/property/${params.bookingId}`;

  return (
    <BrochureClient
      pw={pw}
      booking={{
        fullAddress: booking.fullAddress,
        address:     booking.address,
        clientName:  booking.clientName,
      }}
      images={images}
      branding={branding}
      listingUrl={listingUrl}
    />
  );
}
