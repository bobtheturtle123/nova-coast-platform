import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import BrochureClient from "./BrochureClient";

export async function generateMetadata({ params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return { title: "Brochure" };
    const bookingDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(params.bookingId)
      .get();
    if (!bookingDoc.exists) return { title: "Brochure" };
    const pw = bookingDoc.data().propertyWebsite;
    const address = pw?.customName || pw?.address || "Property Brochure";
    return { title: `${address} — Brochure` };
  } catch {
    return { title: "Property Brochure" };
  }
}

export default async function BrochurePage({ params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) {
      return <ErrorPage message="Tenant not found." />;
    }

    const bookingDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings").doc(params.bookingId)
      .get();

    if (!bookingDoc.exists) {
      return <ErrorPage message="Listing not found." />;
    }

    const booking = bookingDoc.data();
    const pw = booking.propertyWebsite;

    if (!pw) {
      return <ErrorPage message="Property website not set up yet. Go to the listing's Property Site tab to add details first." />;
    }

    // Fetch all gallery images for the brochure
    let images = [];
    if (booking.galleryId) {
      try {
        const galleryDoc = await adminDb
          .collection("tenants").doc(tenant.id)
          .collection("galleries").doc(booking.galleryId)
          .get();
        if (galleryDoc.exists) {
          images = (galleryDoc.data().media || [])
            .filter((m) => !m.fileType?.startsWith("video/") && m.url)
            .slice(0, 9)
            .map((m) => ({ url: String(m.url) })); // strip Firestore Timestamps / non-serializable fields
        }
      } catch {}
    }

    // Sanitize pw — strip any Firestore Timestamp fields that would fail Next.js serialization
    const safePw = JSON.parse(JSON.stringify(pw, (_, v) => {
      if (v && typeof v === "object" && typeof v.toDate === "function") return v.toDate().toISOString();
      return v;
    }));

    const branding = {
      primary: tenant.branding?.primaryColor  || "#3486cf",
      accent:  tenant.branding?.accentColor   || "#c9a96e",
      bizName: tenant.branding?.businessName  || tenant.businessName || "",
      tagline: tenant.branding?.tagline       || "",
      logo:    tenant.branding?.logoUrl       || null,
      phone:   tenant.branding?.phone         || "",
      email:   tenant.branding?.email         || "",
      website: tenant.branding?.website       || "",
    };

    // Build listing URL — fall back to relative if env var not set
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    const listingUrl = appUrl
      ? `${appUrl}/${params.slug}/property/${params.bookingId}`
      : `/${params.slug}/property/${params.bookingId}`;

    return (
      <BrochureClient
        pw={safePw}
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
  } catch (err) {
    console.error("[brochure] Server error:", err);
    return <ErrorPage message="Something went wrong generating the brochure. Please try again." />;
  }
}

function ErrorPage({ message }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-6">
      <div>
        <p className="text-4xl mb-4">📋</p>
        <p className="text-white/70 text-lg mb-2">Brochure Unavailable</p>
        <p className="text-white/40 text-sm max-w-sm">{message}</p>
      </div>
    </div>
  );
}
