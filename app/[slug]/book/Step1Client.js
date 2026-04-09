"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import { getSqftTier, getItemPrice, getFromPrice, SQFT_TIERS } from "@/lib/catalogUtils";
import clsx from "clsx";

const TIER_LABELS = Object.fromEntries(SQFT_TIERS.map((t) => [t.name, t.label]));

export default function TenantBookStep1Client({ slug, tenantId, tenantName, catalog }) {
  const router = useRouter();
  const {
    packageId, serviceIds, squareFootage,
    setPackage, toggleService, hasSelections, setTenant, setSquareFootage,
  } = useBookingStore();

  useEffect(() => {
    setTenant(slug, tenantId, tenantName);
  }, [slug, tenantId, tenantName, setTenant]);

  const tier = getSqftTier(squareFootage);
  const { packages = [], services = [] } = catalog;

  function displayPrice(item) {
    if (tier) {
      return `$${getItemPrice(item, tier).toLocaleString()}`;
    }
    return `From $${getFromPrice(item).toLocaleString()}`;
  }

  return (
    <>
      <StepProgress current={1} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 1 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">Choose your package.</h1>
          <p className="font-body text-gray-500">Enter your square footage for exact pricing, then pick a package or build your own.</p>
        </div>

        {/* Square footage input */}
        <div className="mb-10 max-w-xs">
          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Interior Square Footage
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="e.g. 2,400"
              value={squareFootage}
              onChange={(e) => setSquareFootage(e.target.value)}
              className="input-field w-full font-display text-2xl text-navy"
            />
            {tier ? (
              <p className="text-xs font-bold text-gold uppercase tracking-widest mt-2">
                {TIER_LABELS[tier]}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">Prices shown are starting rates</p>
            )}
          </div>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {packages.map((pkg) => {
            const selected = packageId === pkg.id;
            return (
              <button key={pkg.id} onClick={() => setPackage(pkg.id)}
                className={clsx(
                  "relative text-left p-6 border rounded-sm transition-all duration-200 focus:outline-none",
                  selected
                    ? "border-navy bg-navy text-white shadow-lg"
                    : "border-gray-200 bg-white hover:border-navy/40 hover:shadow-sm"
                )}>
                {pkg.featured && (
                  <span className={clsx(
                    "absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full tracking-wide",
                    selected ? "bg-gold text-navy" : "bg-navy text-gold"
                  )}>Most Popular</span>
                )}
                <p className={clsx("font-display text-2xl mb-1", selected ? "text-white" : "text-navy")}>{pkg.name}</p>
                <p className={clsx("font-display text-3xl mb-1", selected ? "text-gold" : "text-navy")}>
                  {displayPrice(pkg)}
                </p>
                {!tier && (
                  <p className={clsx("text-xs mb-2", selected ? "text-white/60" : "text-gray-400")}>
                    Enter sq ft for your exact price
                  </p>
                )}
                <p className={clsx("text-sm mb-4 leading-relaxed", selected ? "text-white/80" : "text-gray-500")}>{pkg.tagline}</p>
                <ul className="space-y-1">
                  {(pkg.includes || []).map((sid) => {
                    const svc = services.find((s) => s.id === sid);
                    return (
                      <li key={sid} className={clsx("text-sm flex items-center gap-2", selected ? "text-white/90" : "text-charcoal")}>
                        <span className="text-gold">✓</span>
                        {svc?.name || sid}
                      </li>
                    );
                  })}
                </ul>
                {pkg.deliverables && (
                  <p className={clsx("text-xs mt-4", selected ? "text-white/60" : "text-gray-400")}>{pkg.deliverables}</p>
                )}
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
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={clsx(
                      "text-left p-5 border rounded-sm transition-all duration-200 flex items-start justify-between gap-4 focus:outline-none",
                      selected ? "border-navy bg-navy/5 shadow-sm" : "border-gray-200 bg-white hover:border-navy/30"
                    )}>
                    <div>
                      <p className={clsx("font-semibold mb-1", selected ? "text-navy" : "text-charcoal")}>{svc.name}</p>
                      <p className="text-sm text-gray-500">{svc.description}</p>
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
