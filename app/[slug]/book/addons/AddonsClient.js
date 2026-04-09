"use client";

import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { calculateTenantPrice } from "@/lib/tenants";
import StepProgress from "@/components/booking/StepProgress";
import PriceSummary from "@/components/booking/PriceSummary";
import clsx from "clsx";

export default function TenantAddonsClient({ slug, addons = [], catalog }) {
  const router = useRouter();
  const { packageId, serviceIds, addonIds, toggleAddon, setPricing, travelFee } =
    useBookingStore();

  function handleContinue() {
    const pricing = calculateTenantPrice(packageId, serviceIds, addonIds, travelFee, catalog);
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
                return (
                  <button key={addon.id} onClick={() => toggleAddon(addon.id)}
                    className={clsx(
                      "w-full text-left p-5 border rounded-sm transition-all duration-200 flex items-center justify-between gap-4 focus:outline-none",
                      selected ? "border-navy bg-navy/5" : "border-gray-200 bg-white hover:border-navy/30"
                    )}>
                    <div>
                      <p className={clsx("font-body font-semibold mb-0.5", selected ? "text-navy" : "text-charcoal")}>
                        {addon.name}
                      </p>
                      <p className="text-sm text-gray-500">{addon.description}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className={clsx("font-display text-xl", selected ? "text-navy" : "text-charcoal")}>
                        +${addon.price}
                      </span>
                      <div className={clsx("w-12 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0",
                        selected ? "bg-navy" : "bg-gray-200")}>
                        <div className={clsx("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
                          selected ? "left-7" : "left-1")} />
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
    </>
  );
}
