"use client";

import { useBookingStore } from "@/store/bookingStore";
import { PACKAGES, SERVICES, ADDONS, formatPrice } from "@/lib/pricing";

export default function PriceSummary({ showDeposit = false }) {
  const { packageId, serviceIds, addonIds, pricing, travelFee } = useBookingStore();

  const selectedPkg = PACKAGES.find((p) => p.id === packageId);
  const selectedSvcs = SERVICES.filter((s) => serviceIds.includes(s.id));
  const selectedAddons = ADDONS.filter((a) => addonIds.includes(a.id));

  if (!pricing && !packageId && serviceIds.length === 0) return null;

  const subtotal = pricing?.subtotal ?? 0;
  const deposit  = pricing?.deposit  ?? 0;
  const balance  = pricing?.balance  ?? 0;

  return (
    <div className="card sticky top-6">
      <p className="section-label mb-4">Order Summary</p>

      <div className="space-y-2 text-sm font-body">
        {/* Package */}
        {selectedPkg && (
          <div className="flex justify-between">
            <span className="text-charcoal font-medium">{selectedPkg.name} Package</span>
            <span>{formatPrice(selectedPkg.price)}</span>
          </div>
        )}

        {/* À-carte services */}
        {selectedSvcs.map((s) => (
          <div key={s.id} className="flex justify-between">
            <span className="text-charcoal">{s.name}</span>
            <span>{formatPrice(s.price)}</span>
          </div>
        ))}

        {/* Add-ons */}
        {selectedAddons.length > 0 && (
          <>
            <div className="border-t border-gray-100 pt-2 mt-2" />
            {selectedAddons.map((a) => (
              <div key={a.id} className="flex justify-between">
                <span className="text-charcoal">{a.name}</span>
                <span>{formatPrice(a.price)}</span>
              </div>
            ))}
          </>
        )}

        {/* Travel fee */}
        {travelFee > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Travel fee</span>
            <span>{formatPrice(travelFee)}</span>
          </div>
        )}

        {/* Total */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="text-navy">{formatPrice(subtotal)}</span>
          </div>
        </div>

        {/* Deposit breakdown */}
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
