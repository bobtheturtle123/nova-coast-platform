import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import Link from "next/link";

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

  const address = pw.address || booking.fullAddress || booking.address || "Property";
  const biz = tenant.branding?.businessName || tenant.businessName;

  return {
    title: `${address} — Listed by ${biz}`,
    description: pw.description?.slice(0, 160) || `View photos and details for ${address}`,
    openGraph: {
      title: `${address}`,
      images: pw.heroImageUrl ? [pw.heroImageUrl] : [],
    },
  };
}

export default async function PropertyWebsitePage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(params.bookingId)
    .get();

  if (!bookingDoc.exists) notFound();
  const booking = bookingDoc.data();
  const pw = booking.propertyWebsite;

  if (!pw?.published) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-lg font-display">This property page is not available yet.</p>
          <p className="text-sm mt-2">Please check back later.</p>
        </div>
      </div>
    );
  }

  // Fetch gallery for photos
  let galleryImages = [];
  if (booking.galleryId) {
    const galleryDoc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("galleries").doc(booking.galleryId)
      .get();

    if (galleryDoc.exists) {
      const gallery = galleryDoc.data();
      if (gallery.unlocked || pw.showUnlocked) {
        galleryImages = (gallery.media || [])
          .filter((m) => !m.fileType?.startsWith("video/"))
          .slice(0, 50);
      } else {
        galleryImages = (gallery.media || [])
          .filter((m) => !m.fileType?.startsWith("video/"))
          .slice(0, pw.previewCount || 6);
      }
    }
  }

  const address  = pw.address  || booking.fullAddress || booking.address || "Property";
  const primary  = tenant.branding?.primaryColor || "#0b2a55";
  const accent   = tenant.branding?.accentColor  || "#c9a96e";
  const bizName  = tenant.branding?.businessName || tenant.businessName || "Photographer";
  const heroImg  = pw.heroImageUrl || galleryImages[0]?.url || null;

  const details = [
    pw.price    && { label: "Asking Price",   value: pw.price },
    pw.beds     && { label: "Beds",           value: pw.beds },
    pw.baths    && { label: "Baths",          value: pw.baths },
    pw.sqft     && { label: "Sq Ft",          value: Number(pw.sqft).toLocaleString() },
    pw.type     && { label: "Property Type",  value: pw.type },
    pw.yearBuilt && { label: "Year Built",    value: pw.yearBuilt },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display tracking-wide text-lg" style={{ color: primary }}>
            {bizName}
          </span>
          {pw.agentEmail && (
            <a href={`mailto:${pw.agentEmail}`}
              className="text-sm px-4 py-2 rounded-sm font-medium text-white transition-colors"
              style={{ background: primary }}>
              Contact Agent
            </a>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-[55vh] md:h-[65vh] bg-gray-900 overflow-hidden">
        {heroImg ? (
          <img src={heroImg} alt={address}
            className="absolute inset-0 w-full h-full object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0" style={{ background: primary }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto">
            <p className="text-white/70 text-sm uppercase tracking-widest mb-2">Property Listing</p>
            <h1 className="font-display text-white text-3xl md:text-5xl leading-tight mb-4">{address}</h1>
            {details.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {details.map((d) => (
                  <div key={d.label} className="bg-white/15 backdrop-blur-sm rounded px-4 py-2 text-center">
                    <p className="text-white font-bold text-lg leading-none">{d.value}</p>
                    <p className="text-white/70 text-xs uppercase tracking-wide mt-0.5">{d.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Description */}
            {pw.description && (
              <section>
                <h2 className="font-display text-2xl mb-4" style={{ color: primary }}>About This Property</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{pw.description}</p>
              </section>
            )}

            {/* Photo gallery */}
            {galleryImages.length > 0 && (
              <section>
                <h2 className="font-display text-2xl mb-5" style={{ color: primary }}>
                  Photos <span className="text-base font-body text-gray-400">({galleryImages.length})</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {galleryImages.map((img, i) => (
                    <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                      className={`block rounded-sm overflow-hidden bg-gray-100 hover:opacity-95 transition-opacity
                        ${i === 0 ? "col-span-2 row-span-2 aspect-[4/3]" : "aspect-[4/3]"}`}>
                      <img src={img.url} alt={img.fileName || `Photo ${i + 1}`}
                        className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Features */}
            {pw.features?.length > 0 && (
              <section>
                <h2 className="font-display text-2xl mb-4" style={{ color: primary }}>Features</h2>
                <ul className="grid grid-cols-2 gap-2">
                  {pw.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span style={{ color: accent }} className="mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property details card */}
            {details.length > 0 && (
              <div className="rounded-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-4" style={{ background: primary }}>
                  <p className="text-xs uppercase tracking-widest font-medium" style={{ color: accent }}>Property Details</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {details.map((d) => (
                    <div key={d.label} className="px-5 py-3 flex justify-between">
                      <span className="text-sm text-gray-500">{d.label}</span>
                      <span className="text-sm font-semibold text-gray-800">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent card */}
            {(pw.agentName || pw.agentPhone || pw.agentEmail) && (
              <div className="rounded-sm border border-gray-200 p-5">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Listing Agent</p>
                {pw.agentPhoto && (
                  <img src={pw.agentPhoto} alt={pw.agentName}
                    className="w-16 h-16 rounded-full object-cover mb-3" />
                )}
                {pw.agentName && (
                  <p className="font-semibold text-gray-800 text-lg leading-tight">{pw.agentName}</p>
                )}
                {pw.agentBrokerage && (
                  <p className="text-sm text-gray-500 mb-3">{pw.agentBrokerage}</p>
                )}
                <div className="space-y-2 mt-3">
                  {pw.agentPhone && (
                    <a href={`tel:${pw.agentPhone}`}
                      className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{ color: primary }}>
                      📞 {pw.agentPhone}
                    </a>
                  )}
                  {pw.agentEmail && (
                    <a href={`mailto:${pw.agentEmail}`}
                      className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{ color: primary }}>
                      ✉️ {pw.agentEmail}
                    </a>
                  )}
                </div>
                {pw.agentEmail && (
                  <a href={`mailto:${pw.agentEmail}?subject=Inquiry about ${address}`}
                    className="mt-4 block text-center py-3 rounded-sm text-sm font-semibold text-white transition-colors"
                    style={{ background: primary }}>
                    Send Inquiry
                  </a>
                )}
              </div>
            )}

            {/* Photographer credit */}
            <div className="text-center py-4">
              <p className="text-xs text-gray-400">
                Photography by{" "}
                <span className="font-medium" style={{ color: primary }}>{bizName}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-6 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} {bizName}. All rights reserved.</p>
      </footer>
    </div>
  );
}
