"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import { getSqftTier, getItemPrice, SQFT_TIERS, getPricingLabel } from "@/lib/catalogUtils";
import clsx from "clsx";

// ─── Product Lightbox ──────────────────────────────────────────────────────────
function ProductLightbox({ item, images, price, services, onClose }) {
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
                    className={`w-14 h-10 flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${i === idx ? "border-brand" : "border-transparent"}`}>
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
            <h2 className="font-display text-2xl text-brand">{item.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
          {price && <p className="font-display text-3xl text-brand mb-4">{price}</p>}
          {item.description && (
            <p className="text-gray-600 leading-relaxed mb-4">{item.description}</p>
          )}
          {item.includes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Includes</p>
              <ul className="space-y-1">
                {item.includes.map((s, i) => {
                  const svcName = services?.find((sv) => sv.id === s)?.name || s;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm text-[#0F172A]">
                      <span className="text-accent-brand font-bold">✓</span>{svcName}
                    </li>
                  );
                })}
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


export default function TenantBookStep1Client({ slug, tenantId, tenantName, catalog }) {
  const router = useRouter();
  const {
    packageIds, serviceIds, squareFootage,
    togglePackage, toggleService, hasSelections, setTenant, setSquareFootage,
  } = useBookingStore();

  const pricingConfig = catalog.pricingConfig || {};
  const pricingMode   = pricingConfig.mode || "sqft";
  const usesGate      = pricingMode !== "flat";
  const gateLabel     = getPricingLabel(pricingConfig) || "Value";
  const customLabel   = (pricingConfig.customGateLabel || "value").toLowerCase();
  const gateQuestion  = pricingMode === "photos"
    ? "How many photos do you need?"
    : pricingMode === "custom"
      ? `What's your ${customLabel}?`
      : "What's the square footage?";
  const gateSubtext   = pricingMode === "photos"
    ? "Tell us how many photos you need so we can show you exact pricing."
    : pricingMode === "custom"
      ? `Enter your ${customLabel} so we can show you exact pricing.`
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
            <h1 className="font-display text-4xl mb-3 leading-tight" style={{ color: "var(--color-primary)" }}>{gateQuestion}</h1>
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
                className="w-full bg-transparent border-0 border-b border-gray-200 focus:ring-0 outline-none font-display text-5xl text-center pb-3 mb-2 transition-colors"
                style={{ color: "var(--color-primary)", borderBottomColor: "var(--color-primary)" }}
              />
              <p className="text-xs text-gray-400 mb-7 tracking-widest uppercase">
                {tier && pricingMode !== "photos" && pricingMode !== "custom"
                  ? <span className="text-accent-brand font-semibold">{TIER_LABELS[tier]}</span>
                  : sqftInput
                    ? `${Number(sqftInput).toLocaleString()} ${pricingMode === "photos" ? "photos" : pricingMode === "custom" ? customLabel : "sq ft"}`
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
            <h1 className="font-display text-4xl text-brand mb-1">Choose your services.</h1>
            <p className="font-body text-gray-500">Select one or more packages, then add individual services below.</p>
          </div>
          {usesGate && (
            <button
              onClick={() => setConfirmed(false)}
              className="text-xs text-gray-400 hover:text-brand underline underline-offset-2 whitespace-nowrap pb-1"
            >
              {sqftInput} {pricingMode === "photos" ? "photos" : pricingMode === "custom" ? customLabel : "sqft"}{tier && pricingMode !== "photos" && pricingMode !== "custom" ? ` · ${TIER_LABELS[tier]}` : ""} ✎
            </button>
          )}
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          {packages.map((pkg) => {
            const selected = packageIds.includes(pkg.id);
            const images   = getImages(pkg);
            const img      = images[0];
            return (
              <button key={pkg.id} onClick={() => togglePackage(pkg.id)}
                className={clsx(
                  "relative text-left border-2 rounded-2xl transition-all duration-200 focus:outline-none overflow-hidden flex bg-white",
                  selected ? "shadow-lg" : "border-gray-100 hover:border-gray-200 hover:shadow-md"
                )}
                style={selected ? { borderColor: "var(--color-primary)", boxShadow: `0 4px 20px color-mix(in srgb, var(--color-primary) 20%, transparent)` } : {}}>

                {/* Left: image */}
                {img && (
                  <div className="relative w-36 sm:w-44 flex-shrink-0 overflow-hidden">
                    <img src={img} alt={pkg.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
                    {pkg.featured && (
                      <div className="absolute top-2 left-0 right-0 flex justify-center">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
                          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-primary)" }}>
                          Most Popular
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Right: content */}
                <div className="p-5 flex flex-col flex-1 min-w-0 transition-colors relative"
                  style={selected ? { backgroundColor: `color-mix(in srgb, var(--color-primary) 5%, white)` } : {}}>

                  {/* Selected checkmark */}
                  {selected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ backgroundColor: "var(--color-primary)" }}>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {!img && pkg.featured && (
                    <div className="mb-2">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide"
                        style={{ backgroundColor: "var(--color-accent)", color: "var(--color-primary)" }}>
                        Most Popular
                      </span>
                    </div>
                  )}

                  <p className="font-display text-xl mb-0.5 pr-8" style={{ color: "var(--color-primary)" }}>{pkg.name}</p>
                  <p className="font-display text-2xl font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
                    {displayPrice(pkg)}
                  </p>

                  {pkg.tagline && (
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">{pkg.tagline}</p>
                  )}

                  {pkg.includes?.length > 0 && (
                    <ul className="space-y-1.5 mb-3 flex-1">
                      {pkg.includes.map((sid) => {
                        const svc = services.find((s) => s.id === sid);
                        return (
                          <li key={sid} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) 12%, transparent)` }}>
                              <svg width="8" height="8" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" style={{ color: "var(--color-primary)" }} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            {svc?.name || sid}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {pkg.deliverables && (
                    <p className="text-xs text-gray-500 border-t border-gray-100 pt-3 mb-2">{pkg.deliverables}</p>
                  )}

                  {(pkg.description || images.length > 0) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxItem({ item: pkg, images, price: displayPrice(pkg) }); }}
                      className="text-xs mt-1 underline underline-offset-2 text-left transition-opacity opacity-50 hover:opacity-100"
                      style={{ color: "var(--color-primary)" }}
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
              <span className="text-xs text-gray-400 uppercase tracking-widest">Add individual services</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-3 mb-12">
              {services.map((svc) => {
                const selected = serviceIds.includes(svc.id);
                const images   = getImages(svc);
                const img      = images[0];
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={clsx(
                      "w-full text-left border rounded-2xl transition-all duration-200 overflow-hidden focus:outline-none flex",
                      selected ? "border-brand shadow-md ring-2 ring-navy/10" : "border-gray-200 bg-white hover:shadow-sm"
                    )}
                    style={selected ? { borderColor: "var(--color-primary)" } : {}}
                    onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = `color-mix(in srgb, var(--color-primary) 35%, transparent)`; }}
                    onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = "#e5e7eb"; }}>

                    {/* Image */}
                    {img && (
                      <div className="relative w-40 sm:w-52 flex-shrink-0 overflow-hidden">
                        <img src={img} alt={svc.name} className="w-full h-full object-cover" />
                        {images.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                            {images.length} photos
                          </span>
                        )}
                        {selected && (
                          <div className="absolute inset-0 flex items-center justify-center"
                            style={{ backgroundColor: `color-mix(in srgb, var(--color-primary) 40%, transparent)` }}>
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow">
                              <span className="font-bold text-base" style={{ color: "var(--color-primary)" }}>✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div className={clsx("flex-1 flex items-center justify-between gap-4 px-6 py-5 min-w-0", selected ? "bg-brand-soft" : "bg-white")}>
                      <div className="flex-1 min-w-0">
                        <p className={clsx("font-semibold text-base mb-1", selected ? "text-brand" : "text-[#0F172A]")}
                          style={selected ? { color: "var(--color-primary)" } : {}}>
                          {svc.name}
                        </p>
                        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{svc.description}</p>
                        {(svc.description?.length > 60 || images.length > 0) && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setLightboxItem({ item: svc, images, price: displayPrice(svc) }); }}
                            className="text-xs font-medium mt-2 underline underline-offset-2 transition-colors"
                            style={{ color: "var(--color-primary)", opacity: 0.6 }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}>
                            View details {images.length > 1 ? `· ${images.length} photos` : ""}
                          </button>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-3">
                        <p className="font-display text-2xl font-semibold"
                          style={{ color: selected ? "var(--color-primary)" : "#0F172A" }}>
                          {displayPrice(svc)}
                        </p>
                        {/* No-image cards show a checkbox; image cards show the overlay tick */}
                        {!img && (
                          <div className="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors"
                            style={selected
                              ? { backgroundColor: "var(--color-primary)", borderColor: "var(--color-primary)" }
                              : { borderColor: "#d1d5db" }}>
                            {selected && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                        )}
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
          services={services}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </>
  );
}
