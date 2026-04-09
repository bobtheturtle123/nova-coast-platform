"use client";

import { useBookingStore } from "@/store/bookingStore";
import { PACKAGES, SERVICES, ADDONS, formatPrice } from "@/lib/pricing";
import { getSqftTier, getItemPrice } from "@/lib/catalogUtils";

// catalog prop overrides the static defaults (used in multi-tenant [slug]/book pages)
export default function PriceSummary({ showDeposit = false, catalog = null }) {
  const { packageId, serviceIds, addonIds, pricing, travelFee, squareFootage } = useBookingStore();
  const tier = getSqftTier(squareFootage);

  const packages = catalog?.packages || PACKAGES;
  const services = catalog?.services || SERVICES;
  const addons   = catalog?.addons   || ADDONS;

  const selectedPkg    = packages.find((p) => p.id === packageId);
  const selectedSvcs   = services.filter((s) => serviceIds.includes(s.id));
  const selectedAddons = addons.filter((a) => addonIds.includes(a.id));

  if (!pricing && !packageId && serviceIds.length === 0) return null;

  const subtotal = pricing?.subtotal ?? 0;
  const deposit  = pricing?.deposit  ?? 0;
  const balance  = pricing?.balance  ?? 0;

  return (
    <div className="card sticky top-6">
      <p className="section-label mb-4">Order Summary</p>

      <div className="space-y-2 text-sm font-body">
        {selectedPkg && (
          <div className="flex justify-between">
            <span className="text-charcoal font-medium">{selectedPkg.name} Package</span>
            <span>{formatPrice(getItemPrice(selectedPkg, tier))}</span>
          </div>
        )}

        {selectedSvcs.map((s) => (
          <div key={s.id} className="flex justify-between">
            <span className="text-charcoal">{s.name}</span>
            <span>{formatPrice(getItemPrice(s, tier))}</span>
          </div>
        ))}

        {selectedAddons.length > 0 && (
          <>
            <div className="border-t border-gray-100 pt-2 mt-2" />
            {selectedAddons.map((a) => (
              <div key={a.id} className="flex justify-between">
                <span className="text-charcoal">{a.name}</span>
                <span>{formatPrice(getItemPrice(a, tier))}</span>
              </div>
            ))}
          </>
        )}

        {travelFee > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Travel fee</span>
            <span>{formatPrice(travelFee)}</span>
          </div>
        )}

        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="text-navy">{formatPrice(subtotal)}</span>
          </div>
        </div>

        {showDeposit && subtotal > 0 && (
          <div className="bg-cream rounded-sm p-3 mt-2 space-y-1">
            <div className="flex justify-between text-gold-dark font-medium">
              <span>Deposit due today (50%)</span>
              <span>{formatPrice(deposit)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Due at delivery</span>
              <span>{formatPrice(balance)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
