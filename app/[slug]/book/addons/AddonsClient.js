"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { calculateTenantPrice, getItemPrice, getSqftTier } from "@/lib/catalogUtils";
import StepProgress from "@/components/booking/StepProgress";
import PriceSummary from "@/components/booking/PriceSummary";
import clsx from "clsx";

// ─── Addon Lightbox ────────────────────────────────────────────────────────────
function AddonLightbox({ addon, images, price, onClose }) {
  const [idx, setIdx] = useState(0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        {images.length > 0 && (
          <div className="relative h-56 overflow-hidden rounded-t-xl bg-gray-100">
            <img src={images[idx]} alt={addon.name} className="w-full h-full object-cover" />
            {images.length > 1 && (
              <>
                <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">‹</button>
                <button onClick={() => setIdx((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">›</button>
              </>
            )}
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <h2 className="font-display text-xl text-navy">{addon.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
          {price && <p className="font-display text-2xl text-navy mb-3">+{price}</p>}
          {addon.description && <p className="text-gray-600 leading-relaxed">{addon.description}</p>}
        </div>
      </div>
    </div>
  );
}

const ADDON_IMAGES = {
  floorplans2d:       "https://novacoastmedia.com/wp-content/uploads/2024/10/Floor-Plans-scaled.jpg",
  floorplans3d:       "https://novacoastmedia.com/wp-content/uploads/2026/01/Standard-Real-Estate-Video-2-copy-1.jpg",
  virtualTwilight:    "https://novacoastmedia.com/wp-content/uploads/2026/03/1-web-or-mls-Altered-Image-Twilight-copy.jpg",
  agentOnCamera:      "https://novacoastmedia.com/wp-content/uploads/2025/08/agent-on-camera.png",
  verticalVideoEdit:  "https://novacoastmedia.com/wp-content/uploads/2025/06/Social-Media-Reel-Real-Estate-copy.jpg",
  virtualStaging:     "https://novacoastmedia.com/wp-content/uploads/2025/09/Virtual-Staging.png",
  traditionalStaging: "https://novacoastmedia.com/wp-content/uploads/2025/09/Virtual-Staging.png",
  grass:              "https://novacoastmedia.com/wp-content/uploads/2025/09/Grass-Enhancer.png",
  detailPhotos:       "https://novacoastmedia.com/wp-content/uploads/2025/06/019776c5-fc99-7398-ad68-e95b6d5140f5.jpeg",
  propertySite:       "https://novacoastmedia.com/wp-content/uploads/2024/12/2024-12-27-12_16_45-San-Diego-Photographer-Rick-Ryan-Photography-—-Mozilla-Firefox.png",
  propertyOutlines:   "https://novacoastmedia.com/wp-content/uploads/2025/06/019776a5-5e35-71bd-ac70-f6186c3ef5c0-scaled.jpeg",
  neighborhoodShots:  "https://novacoastmedia.com/wp-content/uploads/2025/09/Hyper-Local-Stock-Photography-San-Diego-La-jolla.jpg",
  sameDay:            "https://novacoastmedia.com/wp-content/uploads/2025/09/Photo-054.jpg",
};

export default function TenantAddonsClient({ slug, addons = [], catalog }) {
  const router = useRouter();
  const { packageId, serviceIds, addonIds, squareFootage, toggleAddon, setPricing, travelFee } =
    useBookingStore();
  const [lightboxAddon, setLightboxAddon] = useState(null);

  function getImages(addon) {
    if (addon.mediaUrls?.length) return addon.mediaUrls.filter((u) => u && !u.match(/\.(mp4|mov|webm)$/i));
    const fallback = ADDON_IMAGES[addon.id];
    return fallback ? [fallback] : [];
  }

  function handleContinue() {
    const pricing = calculateTenantPrice(packageId, serviceIds, addonIds, travelFee, catalog, squareFootage);
    setPricing(pricing);
    router.push(`/${slug}/book/property`);
  }

  return (
    <>
      <StepProgress current={2} />
      <div className="step-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <div className="mb-8">
              <p className="section-label mb-2">Step 2 of 6</p>
              <h1 className="font-display text-4xl text-navy mb-3">Enhance your shoot.</h1>
              <p className="font-body text-gray-500">Add-ons are optional. Toggle any you'd like included.</p>
            </div>

            <div className="space-y-3">
              {addons.map((addon) => {
                const selected = addonIds.includes(addon.id);
                const images   = getImages(addon);
                const img      = images[0];
                return (
                  <button key={addon.id} onClick={() => toggleAddon(addon.id)}
                    className={clsx(
                      "w-full text-left border rounded-sm transition-all duration-200 overflow-hidden focus:outline-none",
                      selected ? "border-navy bg-navy/5 ring-1 ring-navy/20" : "border-gray-200 bg-white hover:border-navy/30"
                    )}>
                    <div className="flex items-center gap-4 p-4">
                      {img && (
                        <div className="w-20 h-14 flex-shrink-0 overflow-hidden rounded-sm">
                          <img src={img} alt={addon.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={clsx("font-body font-semibold mb-0.5", selected ? "text-navy" : "text-charcoal")}>
                          {addon.name}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-2">{addon.description}</p>
                        {(addon.description?.length > 80 || images.length > 1) && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setLightboxAddon({ addon, images, price: `$${getItemPrice(addon, getSqftTier(squareFootage)).toLocaleString()}` }); }}
                            className="text-xs text-navy/50 hover:text-navy underline underline-offset-2 mt-0.5">
                            View details
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className={clsx("font-display text-xl", selected ? "text-navy" : "text-charcoal")}>
                          +${getItemPrice(addon, getSqftTier(squareFootage)).toLocaleString()}
                        </span>
                        <div className={clsx("w-12 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0",
                          selected ? "bg-navy" : "bg-gray-200")}>
                          <div className={clsx("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
                            selected ? "left-7" : "left-1")} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {addons.length === 0 && (
                <p className="text-gray-400 text-sm">No add-ons available.</p>
              )}
            </div>

            <div className="flex justify-between mt-10">
              <button onClick={() => router.push(`/${slug}/book`)} className="btn-outline">← Back</button>
              <button onClick={handleContinue} className="btn-primary px-12">Continue →</button>
            </div>
          </div>
          <div className="lg:col-span-1"><PriceSummary catalog={catalog} /></div>
        </div>
      </div>

      {lightboxAddon && (
        <AddonLightbox
          addon={lightboxAddon.addon}
          images={lightboxAddon.images}
          price={lightboxAddon.price}
          onClose={() => setLightboxAddon(null)}
        />
      )}
    </>
  );
}
