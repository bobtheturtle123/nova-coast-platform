"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { calculateTenantPrice } from "@/lib/tenants";
import StepProgress from "@/components/booking/StepProgress";

export default function TenantReviewPage() {
  const params = useParams();
  const router = useRouter();
  const store  = useBookingStore();
  const {
    packageId, serviceIds, addonIds, address, city, state, zip,
    squareFootage, propertyType, notes, travelFee, setTravelFee, setPricing, pricing,
  } = store;

  const fullAddress = `${address}, ${city}, ${state} ${zip}`;

  useEffect(() => {
    // Calculate travel fee if we have an address and tenant info
    if (address && zip && store.tenantId) {
      fetch(`/api/${params.slug}/travel-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: fullAddress }),
      })
        .then((r) => r.json())
        .then((data) => {
          const fee = data.travelFee ?? 0;
          setTravelFee(fee);
          // Fetch catalog again to recalculate pricing
          fetch(`/api/tenant-public/${params.slug}/catalog`)
            .then((r) => r.json())
            .then((catalog) => {
              const p = calculateTenantPrice(packageId, serviceIds, addonIds, fee, catalog);
              setPricing(p);
            });
        })
        .catch(() => {});
    }
  }, []);

  if (!pricing) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <StepProgress current={4} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 4 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">Review your booking.</h1>
          <p className="font-body text-gray-500">Everything look right? Hit Continue to choose a date.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <p className="section-label mb-3">Property</p>
              <p className="font-body text-charcoal">{fullAddress}</p>
              <p className="text-sm text-gray-500 mt-1 capitalize">{propertyType}{squareFootage ? ` · ${squareFootage} sq ft` : ""}</p>
              {notes && <p className="text-sm text-gray-500 mt-1 italic">"{notes}"</p>}
            </div>

            <div className="card">
              <p className="section-label mb-3">Services</p>
              <div className="space-y-1 text-sm text-charcoal">
                {packageId && <p>Package: <span className="font-medium capitalize">{packageId}</span></p>}
                {serviceIds.length > 0 && <p>Services: {serviceIds.join(", ")}</p>}
                {addonIds.length > 0 && <p>Add-ons: {addonIds.join(", ")}</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card">
              <p className="section-label mb-4">Price Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Base</span><span>${pricing.base}</span></div>
                {pricing.addonTotal > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Add-ons</span><span>${pricing.addonTotal}</span></div>
                )}
                {pricing.travelFee > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Travel fee</span><span>${pricing.travelFee}</span></div>
                )}
                <div className="flex justify-between font-semibold border-t border-gray-100 pt-2">
                  <span>Total</span><span className="text-navy">${pricing.subtotal}</span>
                </div>
                <div className="flex justify-between text-gold-dark font-medium">
                  <span>Deposit (50%)</span><span>${pricing.deposit}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Due at delivery</span><span>${pricing.balance}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button onClick={() => router.push(`/${params.slug}/book/property`)} className="btn-outline">← Back</button>
          <button onClick={() => router.push(`/${params.slug}/book/schedule`)} className="btn-primary px-12">Continue →</button>
        </div>
      </div>
    </>
  );
}
