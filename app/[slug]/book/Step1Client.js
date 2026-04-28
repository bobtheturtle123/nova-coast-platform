"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import { getSqftTier, getItemPrice, SQFT_TIERS } from "@/lib/catalogUtils";
import clsx from "clsx";

// ─── Product Lightbox ──────────────────────────────────────────────────────────
function ProductLightbox({ item, images, price, onClose }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image carousel */}
        {images.length > 0 && (
          <div className="relative">
            <div className="h-72 overflow-hidden rounded-t-xl bg-gray-100">
              <img src={images[idx]} alt={item.name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <>
                <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                  ‹
                </button>
                <button onClick={() => setIdx((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto bg-gray-50">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`w-14 h-10 flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${i === idx ? "border-navy" : "border-transparent"}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-display text-2xl text-navy">{item.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
          {price && <p className="font-display text-3xl text-navy mb-4">{price}</p>}
          {item.description && (
            <p className="text-gray-600 leading-relaxed mb-4">{item.description}</p>
          )}
          {item.includes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Includes</p>
              <ul className="space-y-1">
                {item.includes.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-charcoal">
                    <span className="text-gold font-bold">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.deliverables && (
            <p className="text-sm text-gray-500 border-t border-gray-100 pt-3">{item.deliverables}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const TIER_LABELS = Object.fromEntries(SQFT_TIERS.map((t) => [t.name, t.label]));

// Images sourced from novacoastmedia.com — update to R2 URLs when migrated
const ITEM_IMAGES = {
  essentials:           "https://novacoastmedia.com/wp-content/uploads/2025/07/Photo-work-05.jpg",
  prime:                "https://novacoastmedia.com/wp-content/uploads/2025/09/Photo-012.jpg",
  signature:            "https://novacoastmedia.com/wp-content/uploads/2025/09/ucarecjdn-copy.jpg",
  classicDaytime:       "https://novacoastmedia.com/wp-content/uploads/2024/09/Portfolio-59.jpg",
  luxuryDaytime:        "https://novacoastmedia.com/wp-content/uploads/2026/02/Altered-Photo-25-copy.jpg",
  drone:                "https://novacoastmedia.com/wp-content/uploads/2026/01/Standard-Real-Estate-Video-2-copy.jpg",
  realTwilight:         "https://novacoastmedia.com/wp-content/uploads/2026/01/1-web-or-mls-Photo-124.jpg",
  premiumCinematicVideo:"https://novacoastmedia.com/wp-content/uploads/2025/09/Video.jpg",
  luxuryCinematicVideo: "https://novacoastmedia.com/wp-content/uploads/2026/03/1-web-or-mls-Photo-124-copy.jpg",
  socialReel:           "https://novacoastmedia.com/wp-content/uploads/2025/06/Social-Media-Reel-Real-Estate-copy.jpg",
  matterport:           "https://novacoastmedia.com/wp-content/uploads/2025/06/mp_realestate-dollhouse-copy.jpg",
  zillow3d:             "https://novacoastmedia.com/wp-content/uploads/2025/06/fg.jpg",
};

const PACKAGE_TIER_TAGS = {
  essentials: "Photos · Drone · Digital Twilight",
  prime:      "Photos · Drone · Twilight · Website",
  signature:  "Photos · Drone · Twilight · Video · Website",
};

export default function TenantBookStep1Client({ slug, tenantId, tenantName, catalog }) {
  const router = useRouter();
  const {
    packageId, serviceIds, squareFootage,
    setPackage, toggleService, hasSelections, setTenant, setSquareFootage,
  } = useBookingStore();

  const pricingConfig = catalog.pricingConfig || {};
  const pricingMode   = pricingConfig.mode || "sqft";
  const usesGate      = pricingMode !== "flat";
  const gateLabel     = pricingMode === "photos" ? "Number of Photos" : "Interior Square Footage";
  const gateQuestion  = pricingMode === "photos" ? "How many photos do you need?" : "What's the square footage?";
  const gateSubtext   = pricingMode === "photos"
    ? "Tell us how many photos you need so we can show you exact pricing."
    : "Enter the interior square footage of the home so we can show you exact pricing.";

  const [sqftInput,    setSqftInput]    = useState(squareFootage || "");
  const [confirmed,    setConfirmed]    = useState(!usesGate || !!squareFootage);
  const [lightboxItem, setLightboxItem] = useState(null); // { item, images, price }

  // Get images for an item: prefer mediaUrls, fall back to ITEM_IMAGES lookup
  function getImages(item) {
    if (item.mediaUrls?.length) return item.mediaUrls.filter((u) => u && !u.match(/\.(mp4|mov|webm)$/i));
    const fallback = ITEM_IMAGES[item.id];
    return fallback ? [fallback] : [];
  }

  useEffect(() => {
    setTenant(slug, tenantId, tenantName);
    if (!usesGate) { setSquareFootage(""); setConfirmed(true); }
  }, [slug, tenantId, tenantName, setTenant, usesGate, setSquareFootage]);

  const tier = getSqftTier(sqftInput, pricingConfig);
  const { packages = [], services = [] } = catalog;

  function confirmSqft() {
    setSquareFootage(sqftInput);
    setConfirmed(true);
  }

  function displayPrice(item) {
    if (!usesGate) return item.price ? `$${item.price.toLocaleString()}` : "";
    return `$${getItemPrice(item, tier).toLocaleString()}`;
  }

  // ── Pricing gate (sqft / photo count) ─────────────────────────────────────
  if (usesGate && !confirmed) {
    const canConfirm = pricingMode === "photos" ? !!sqftInput : !!tier;
    return (
      <>
        <StepProgress current={1} />
        <div className="step-container">
          <div className="max-w-md mx-auto text-center">
            <p className="section-label mb-4">Step 1 of 6</p>
            <h1 className="font-display text-4xl text-navy mb-3 leading-tight">{gateQuestion}</h1>
            <p className="font-body text-gray-400 mb-10 leading-relaxed">{gateSubtext}</p>

            <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                autoFocus
                placeholder={pricingMode === "photos" ? "30" : "2400"}
                value={sqftInput}
                onChange={(e) => setSqftInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canConfirm && confirmSqft()}
                className="w-full bg-transparent border-0 border-b border-gray-200 focus:border-navy focus:ring-0 outline-none font-display text-5xl text-navy text-center pb-3 mb-2 transition-colors"
              />
              <p className="text-xs text-gray-400 mb-7 tracking-widest uppercase">
                {tier && pricingMode !== "photos"
                  ? <span className="text-gold font-semibold">{TIER_LABELS[tier]}</span>
                  : sqftInput
                    ? `${Number(sqftInput).toLocaleString()} ${pricingMode === "photos" ? "photos" : "sq ft"}`
                    : gateLabel
                }
              </p>
              <button onClick={confirmSqft} disabled={!canConfirm} className="btn-primary w-full py-3.5">
                Show Pricing →
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Package + service selection ────────────────────────────────────────────
  return (
    <>
      <StepProgress current={1} />
      <div className="step-container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="section-label mb-2">Step 1 of 6</p>
            <h1 className="font-display text-4xl text-navy mb-1">Choose your package.</h1>
            <p className="font-body text-gray-500">Select a package below, or scroll down to build your own.</p>
          </div>
          {usesGate && (
            <button
              onClick={() => setConfirmed(false)}
              className="text-xs text-gray-400 hover:text-navy underline underline-offset-2 whitespace-nowrap pb-1"
            >
              {sqftInput} {pricingMode === "photos" ? "photos" : "sqft"}{tier && pricingMode !== "photos" ? ` · ${TIER_LABELS[tier]}` : ""} ✎
            </button>
          )}
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {packages.map((pkg) => {
            const selected = packageId === pkg.id;
            const images   = getImages(pkg);
            const img      = images[0];
            return (
              <button key={pkg.id} onClick={() => setPackage(pkg.id)}
                className={clsx(
                  "relative text-left border rounded-xl transition-all duration-200 focus:outline-none overflow-hidden flex flex-col",
                  selected
                    ? "border-navy shadow-lg ring-2 ring-navy/20"
                    : "border-gray-200 bg-white hover:border-navy/40 hover:shadow-sm"
                )}>
                {pkg.featured && (
                  <span className={clsx(
                    "absolute top-3 left-3 z-10 text-xs font-semibold px-3 py-1 rounded-full tracking-wide",
                    selected ? "bg-gold text-navy" : "bg-navy text-gold"
                  )}>Most Popular</span>
                )}
                {img && (
                  <div className="relative h-44 overflow-hidden flex-shrink-0 group">
                    <img src={img} alt={pkg.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {images.length > 1 && (
                      <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
                        1/{images.length}
                      </span>
                    )}
                  </div>
                )}
                <div className={clsx("p-5 flex flex-col flex-1", selected ? "bg-navy" : "bg-white")}>
                  {PACKAGE_TIER_TAGS[pkg.id] && (
                    <p className={clsx("text-xs font-semibold uppercase tracking-wider mb-2", selected ? "text-gold" : "text-gold/80")}>
                      {PACKAGE_TIER_TAGS[pkg.id]}
                    </p>
                  )}
                  <p className={clsx("font-display text-2xl mb-1", selected ? "text-white" : "text-navy")}>{pkg.name}</p>
                  <p className={clsx("font-display text-3xl mb-3", selected ? "text-gold" : "text-navy")}>
                    {displayPrice(pkg)}
                  </p>
                  <p className={clsx("text-sm mb-4 leading-relaxed flex-1", selected ? "text-white/80" : "text-gray-500")}>{pkg.tagline}</p>
                  <ul className="space-y-1.5 mb-4">
                    {(pkg.includes || []).map((sid) => {
                      const svc = services.find((s) => s.id === sid);
                      return (
                        <li key={sid} className={clsx("text-sm flex items-center gap-2", selected ? "text-white/90" : "text-charcoal")}>
                          <span className="text-gold font-bold">✓</span>
                          {svc?.name || sid}
                        </li>
                      );
                    })}
                  </ul>
                  {pkg.deliverables && (
                    <p className={clsx("text-xs border-t pt-3", selected ? "text-white/50 border-white/20" : "text-gray-400 border-gray-100")}>
                      {pkg.deliverables}
                    </p>
                  )}
                  {(pkg.description || images.length > 0) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxItem({ item: pkg, images, price: displayPrice(pkg) }); }}
                      className={clsx("text-xs mt-2 underline underline-offset-2 text-left", selected ? "text-white/60 hover:text-white" : "text-navy/50 hover:text-navy")}
                    >
                      View details {images.length > 1 ? `(${images.length} photos)` : ""}
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {services.length > 0 && (
          <>
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-widest">Or build your own</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
              {services.map((svc) => {
                const selected = serviceIds.includes(svc.id);
                const images   = getImages(svc);
                const img      = images[0];
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={clsx(
                      "text-left border rounded-xl transition-all duration-200 overflow-hidden focus:outline-none",
                      selected ? "border-navy shadow-sm ring-1 ring-navy/20" : "border-gray-200 bg-white hover:border-navy/30"
                    )}>
                    {img && (
                      <div className="relative h-36 overflow-hidden">
                        <img src={img} alt={svc.name} className="w-full h-full object-cover" />
                        {images.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
                            {images.length} photos
                          </span>
                        )}
                      </div>
                    )}
                    <div className={clsx("p-4 flex items-start justify-between gap-4", selected ? "bg-navy/5" : "bg-white")}>
                      <div className="flex-1 min-w-0">
                        <p className={clsx("font-semibold mb-1", selected ? "text-navy" : "text-charcoal")}>{svc.name}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{svc.description}</p>
                        {(svc.description?.length > 80 || images.length > 0) && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setLightboxItem({ item: svc, images, price: displayPrice(svc) }); }}
                            className="text-xs text-navy/50 hover:text-navy underline underline-offset-2 mt-1">
                            View details
                          </button>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={clsx("font-display text-xl", selected ? "text-navy" : "text-charcoal")}>
                          {displayPrice(svc)}
                        </p>
                        <div className={clsx("mt-2 w-5 h-5 rounded border-2 flex items-center justify-center ml-auto",
                          selected ? "bg-navy border-navy" : "border-gray-300")}>
                          {selected && <span className="text-white text-xs">✓</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button onClick={() => router.push(`/${slug}/book/addons`)}
            disabled={!hasSelections()} className="btn-primary px-12">
            Continue →
          </button>
        </div>
      </div>

      {/* Product lightbox */}
      {lightboxItem && (
        <ProductLightbox
          item={lightboxItem.item}
          images={lightboxItem.images}
          price={lightboxItem.price}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </>
  );
}
