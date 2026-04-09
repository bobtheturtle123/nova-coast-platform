"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import { getSqftTier, getItemPrice, SQFT_TIERS } from "@/lib/catalogUtils";
import clsx from "clsx";

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
  // Skip the gate if flat pricing (no tier variable)
  const usesGate      = pricingMode !== "flat";
  const gateLabel     = pricingMode === "photos" ? "Number of Photos" : "Interior Square Footage";
  const gateQuestion  = pricingMode === "photos" ? "How many photos do you need?" : "What's the square footage?";
  const gateSubtext   = pricingMode === "photos"
    ? "Tell us how many photos you need so we can show you exact pricing."
    : "Enter the interior square footage of the home so we can show you exact pricing.";

  const [sqftInput, setSqftInput] = useState(squareFootage || "");
  const [confirmed, setConfirmed] = useState(!usesGate || !!squareFootage);

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
          <div className="max-w-lg mx-auto text-center">
            <p className="section-label mb-3">Step 1 of 6</p>
            <h1 className="font-display text-4xl text-navy mb-3">{gateQuestion}</h1>
            <p className="font-body text-gray-500 mb-10">{gateSubtext}</p>

            <div className="bg-white border border-gray-200 rounded-sm p-8 shadow-sm">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {gateLabel}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                autoFocus
                placeholder={pricingMode === "photos" ? "e.g. 30" : "e.g. 2,400"}
                value={sqftInput}
                onChange={(e) => setSqftInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canConfirm && confirmSqft()}
                className="input-field w-full font-display text-4xl text-navy text-center mb-4"
              />
              {tier && pricingMode !== "photos" ? (
                <p className="text-sm font-bold text-gold uppercase tracking-widest mb-6">
                  {TIER_LABELS[tier]}
                </p>
              ) : (
                <p className="text-sm text-gray-400 mb-6">
                  {sqftInput ? `${sqftInput} ${pricingMode === "photos" ? "photos" : "sqft"}` : `Enter ${gateLabel.toLowerCase()} above`}
                </p>
              )}
              <button onClick={confirmSqft} disabled={!canConfirm} className="btn-primary w-full py-4 text-base">
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
            const img = ITEM_IMAGES[pkg.id];
            return (
              <button key={pkg.id} onClick={() => setPackage(pkg.id)}
                className={clsx(
                  "relative text-left border rounded-sm transition-all duration-200 focus:outline-none overflow-hidden flex flex-col",
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
                  <div className="relative h-44 overflow-hidden flex-shrink-0">
                    <img src={img} alt={pkg.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
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
                const img = ITEM_IMAGES[svc.id];
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={clsx(
                      "text-left border rounded-sm transition-all duration-200 overflow-hidden focus:outline-none",
                      selected ? "border-navy shadow-sm ring-1 ring-navy/20" : "border-gray-200 bg-white hover:border-navy/30"
                    )}>
                    {img && (
                      <div className="h-36 overflow-hidden">
                        <img src={img} alt={svc.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className={clsx("p-4 flex items-start justify-between gap-4", selected ? "bg-navy/5" : "bg-white")}>
                      <div className="flex-1">
                        <p className={clsx("font-semibold mb-1", selected ? "text-navy" : "text-charcoal")}>{svc.name}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{svc.description}</p>
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
    </>
  );
}
