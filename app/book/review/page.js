"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useBookingStore } from "@/store/bookingStore";
import { calculatePrice, formatPrice, PACKAGES, SERVICES, ADDONS } from "@/lib/pricing";
import StepProgress from "@/components/booking/StepProgress";
import clsx from "clsx";

export default function ReviewPage() {
  const router = useRouter();
  const store  = useBookingStore();

  const {
    packageId, serviceIds, addonIds,
    address, city, state, zip,
    travelFee, setTravelFee, setPricing, pricing,
  } = store;

  const [loadingFee, setLoadingFee] = useState(false);
  const [feeError,   setFeeError]   = useState(null);

  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  // Fetch travel fee when page loads
  useEffect(() => {
    if (!fullAddress) return;

    setLoadingFee(true);
    setFeeError(null);

    fetch("/api/travel-fee", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ address: fullAddress }),
    })
      .then((r) => r.json())
      .then(({ fee }) => {
        setTravelFee(fee ?? 0);
        const p = calculatePrice(packageId, serviceIds, addonIds, fee ?? 0);
        setPricing(p);
      })
      .catch(() => {
        setFeeError("Couldn't calculate travel fee — we'll confirm this manually.");
        const p = calculatePrice(packageId, serviceIds, addonIds, 0);
        setPricing(p);
      })
      .finally(() => setLoadingFee(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPkg    = PACKAGES.find((p) => p.id === packageId);
  const selectedSvcs   = SERVICES.filter((s) => serviceIds.includes(s.id));
  const selectedAddons = ADDONS.filter((a) => addonIds.includes(a.id));

  const lineItems = [
    ...(selectedPkg
      ? [{ label: `${selectedPkg.name} Package`, price: selectedPkg.price }]
      : selectedSvcs.map((s) => ({ label: s.name, price: s.price }))),
    ...selectedAddons.map((a) => ({ label: a.name, price: a.price })),
    ...(travelFee > 0
      ? [{ label: "Travel fee", price: travelFee, muted: true }]
      : []),
  ];

  return (
    <>
      <StepProgress current={4} />

      <div className="step-container max-w-xl">
        <div className="mb-8">
          <p className="section-label mb-2">Step 4 of 6</p>
          <h1 className="font-display text-4xl text-[#3486cf] mb-3">
            Review your order.
          </h1>
          <p className="font-body text-gray-500">{fullAddress}</p>
        </div>

        <div className="card mb-6">
          {/* Line items */}
          <div className="space-y-3 mb-4">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm font-body">
                <span className={item.muted ? "text-gray-400" : "text-[#0F172A]"}>
                  {item.label}
                </span>
                <span className={item.muted ? "text-gray-400" : "text-[#0F172A] font-medium"}>
                  {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>

          {/* Travel fee loading state */}
          {loadingFee && (
            <div className="flex items-center gap-2 text-sm text-gray-400 font-body py-2">
              <div className="w-3 h-3 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
              Calculating travel fee...
            </div>
          )}
          {feeError && (
            <p className="text-xs text-amber-600 font-body">{feeError}</p>
          )}

          {/* Total */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex justify-between items-baseline">
              <span className="font-body font-semibold text-[#0F172A]">Total</span>
              <span className="font-display text-3xl text-[#3486cf]">
                {pricing ? formatPrice(pricing.subtotal) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Deposit breakdown */}
        {pricing && (
          <div className="bg-[#3486cf]/5 border border-[#3486cf]/10 rounded-xl p-4 mb-8 space-y-2">
            <p className="text-xs font-body font-medium text-[#3486cf] uppercase tracking-widest mb-3">
              Payment Schedule
            </p>
            <div className="flex justify-between text-sm font-body">
              <span className="text-[#0F172A]">Deposit due today</span>
              <span className="font-semibold text-[#3486cf]">{formatPrice(pricing.deposit)}</span>
            </div>
            <div className="flex justify-between text-sm font-body">
              <span className="text-gray-500">Balance due at delivery</span>
              <span className="text-gray-500">{formatPrice(pricing.balance)}</span>
            </div>
            <p className="text-xs text-gray-400 font-body pt-1">
              Your download link unlocks automatically when the balance is paid.
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => router.push("/book/property")} className="btn-outline">
            ← Back
          </button>
          <button
            onClick={() => router.push("/book/schedule")}
            disabled={loadingFee || !pricing}
            className="btn-primary px-12"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
