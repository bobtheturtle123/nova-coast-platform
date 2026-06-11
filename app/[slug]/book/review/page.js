"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { calculateTenantPrice, getSqftTier, depositLabel, getItemPrice } from "@/lib/catalogUtils";
import StepProgress from "@/components/booking/StepProgress";

export default function TenantReviewPage() {
  const params = useParams();
  const router = useRouter();
  const store  = useBookingStore();
  const {
    packageIds, serviceIds, addonIds, address, unit, city, state, zip,
    squareFootage, propertyType, notes, travelFee, setTravelFee, setPricing, pricing,
    promoCode, discount, setPromo, clearPromo, customFields,
    preferredDate, preferredTime, preferredTimeSpecific,
  } = store;

  const scheduleLabel = preferredDate
    ? `${new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${preferredTimeSpecific ? ` at ${preferredTimeSpecific}` : preferredTime ? ` · ${preferredTime}` : ""}`
    : null;

  const [catalog,       setCatalog]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [promoInput,    setPromoInput]    = useState(promoCode || "");
  const [promoMsg,      setPromoMsg]      = useState(promoCode ? { text: discount > 0 ? `Code applied — $${discount} off` : "Code applied", ok: true } : null);
  const [promoLoading,  setPromoLoading]  = useState(false);
  const fullAddress = [address, unit, city, state, zip].filter(Boolean).join(", ");
  // Custom questions the agent answered on the property step.
  const customFieldDefs = catalog?.bookingConfig?.customFields || [];
  const answeredCustom = customFieldDefs
    .map((f) => ({ label: f.label, value: (customFields || {})[f.id] }))
    .filter((x) => x.value && String(x.value).trim());
  const tier = getSqftTier(Number(squareFootage) || 0);

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoMsg(null);
    try {
      const res = await fetch(`/api/${params.slug}/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), subtotal: pricing?.subtotal || 0 }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromo(data.code, data.promoId, data.discount);
        setPromoMsg({ text: data.message, ok: true });
        // Recalculate pricing with discount applied
        if (pricing) setPricing({ ...pricing, discount: data.discount, finalTotal: data.finalTotal });
      } else {
        clearPromo();
        setPromoMsg({ text: data.message || "Invalid code", ok: false });
      }
    } catch {
      setPromoMsg({ text: "Error checking code", ok: false });
    }
    setPromoLoading(false);
  }

  useEffect(() => {
    async function loadAndPrice() {
      try {
        // Fetch catalog + optional travel fee in parallel
        const [catalogRes, travelRes] = await Promise.all([
          fetch(`/api/tenant-public/${params.slug}/catalog`).then((r) => r.json()),
          address && zip
            ? fetch(`/api/${params.slug}/travel-fee`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address: fullAddress }),
              }).then((r) => r.json()).catch(() => ({ travelFee: 0 }))
            : Promise.resolve({ travelFee: 0 }),
        ]);
        setCatalog(catalogRes);
        const fee = travelRes?.travelFee ?? 0;
        setTravelFee(fee);
        const p = calculateTenantPrice(packageIds, serviceIds, addonIds, fee, catalogRes, Number(squareFootage) || 0);
        setPricing(p);
      } finally {
        setLoading(false);
      }
    }
    loadAndPrice();
  }, []);

  // Build readable line items from catalog
  const pkgItems = (packageIds || []).map((id) => catalog?.packages?.find((p) => p.id === id)).filter(Boolean);
  const svcItems = (serviceIds || []).map((id) => catalog?.services?.find((s) => s.id === id)).filter(Boolean);
  const adnItems = (addonIds   || []).map((id) => catalog?.addons?.find((a) => a.id === id)).filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <StepProgress current={5} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 4 of 6</p>
          <h1 className="font-display text-4xl text-[#3486cf] mb-3">Review your booking.</h1>
          <p className="font-body text-gray-500">Everything look right? Hit Continue to choose a date.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">

            {/* Property card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Property</p>
                <button onClick={() => router.push(`/${params.slug}/book/property`)}
                  className="text-xs text-[#3486cf] hover:underline">Edit</button>
              </div>
              <p className="font-medium text-[#0F172A]">{fullAddress}</p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="capitalize">{propertyType || "Residential"}</span>
                {squareFootage && (() => {
                  const pMode = catalog?.pricingConfig?.mode || "sqft";
                  const valLabel = pMode === "photos" ? "photos" : pMode === "custom" ? (catalog?.pricingConfig?.customGateLabel || "value").toLowerCase() : "sq ft";
                  return (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{Number(squareFootage).toLocaleString()} {valLabel}</span>
                      {tier && pMode !== "photos" && pMode !== "custom" && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-[#3486cf] font-medium">{tier} tier</span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              {notes && (
                <p className="text-sm text-gray-400 mt-2 italic border-t border-gray-100 pt-2">
                  "{notes}"
                </p>
              )}
            </div>

            {/* Schedule (chosen on the previous step) */}
            {scheduleLabel && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-label">Schedule</p>
                  <button onClick={() => router.push(`/${params.slug}/book/schedule`)}
                    className="text-xs text-[#3486cf] hover:underline">Edit</button>
                </div>
                <p className="font-medium text-[#0F172A]">{scheduleLabel}</p>
              </div>
            )}

            {/* Custom questions & answers */}
            {answeredCustom.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-label">Additional Details</p>
                  <button onClick={() => router.push(`/${params.slug}/book/property`)}
                    className="text-xs text-[#3486cf] hover:underline">Edit</button>
                </div>
                <div className="space-y-2">
                  {answeredCustom.map((q, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm">
                      <span className="text-gray-500 flex-shrink-0">{q.label}</span>
                      <span className="font-medium text-[#0F172A] text-right break-words min-w-0">{q.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Services</p>
                <button onClick={() => router.push(`/${params.slug}/book`)}
                  className="text-xs text-[#3486cf] hover:underline">Edit</button>
              </div>
              <div className="space-y-2">
                {pkgItems.map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#3486cf] flex-shrink-0 ml-4">
                      ${getItemPrice(pkg, tier)?.toLocaleString()}
                    </p>
                  </div>
                ))}
                {svcItems.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                    </div>
                    <p className="text-sm font-semibold text-[#3486cf] flex-shrink-0 ml-4">
                      ${getItemPrice(s, tier)?.toLocaleString()}
                    </p>
                  </div>
                ))}
                {adnItems.length > 0 && (
                  <div className="border-t border-dashed border-gray-100 pt-2 mt-2 space-y-1.5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Add-ons</p>
                    {adnItems.map((a) => (
                      <div key={a.id} className="flex items-center justify-between">
                        <p className="text-sm text-[#0F172A]">{a.name}</p>
                        <p className="text-sm text-[#3486cf] font-medium flex-shrink-0 ml-4">
                          +${(a.price || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Price summary */}
          <div className="lg:col-span-1">
            {pricing && (
              <div className="card sticky top-6">
                <p className="section-label mb-4">Price Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Services</span>
                    <span className="font-medium">${pricing.base?.toLocaleString()}</span>
                  </div>
                  {pricing.addonTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Add-ons</span>
                      <span className="font-medium">${pricing.addonTotal?.toLocaleString()}</span>
                    </div>
                  )}
                  {pricing.travelFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Travel fee</span>
                      <span className="font-medium">${pricing.travelFee?.toLocaleString()}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo ({promoCode})</span>
                      <span>−${discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-gray-100 pt-2">
                    <span>Total</span>
                    <span className="text-[#3486cf]">${(pricing.finalTotal ?? pricing.subtotal)?.toLocaleString()}</span>
                  </div>
                  {pricing.deposit > 0 ? (
                    <>
                      <div className="flex justify-between text-gold-dark font-semibold">
                        <span className="capitalize">{depositLabel(catalog?.bookingConfig?.deposit)}</span>
                        <span>${pricing.deposit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Balance due at delivery</span>
                        <span>${(pricing.balance ?? 0).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Pay in full at checkout</span>
                      <span>${(pricing.finalTotal ?? pricing.subtotal)?.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Promo code */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Promo Code</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); if (promoMsg) { setPromoMsg(null); clearPromo(); } }}
                      placeholder="Enter code"
                      className="input-field flex-1 text-sm font-mono uppercase"
                      onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    />
                    <button type="button" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                      className="btn-outline text-sm px-3 whitespace-nowrap">
                      {promoLoading ? "…" : "Apply"}
                    </button>
                  </div>
                  {promoMsg && (
                    <p className={`text-xs mt-1.5 ${promoMsg.ok ? "text-green-600" : "text-red-500"}`}>
                      {promoMsg.text}
                    </p>
                  )}
                </div>

                {squareFootage && tier && (catalog?.pricingConfig?.mode || "sqft") === "sqft" && (
                  <div className="mt-4 bg-[#3486cf]/4 rounded-xl p-3 text-xs text-gray-500">
                    Pricing based on <span className="font-medium text-[#3486cf]">{tier} tier</span>
                    {" "}({Number(squareFootage).toLocaleString()} sq ft)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button onClick={() => router.push(`/${params.slug}/book/schedule`)} className="btn-outline">← Back</button>
          <button
            onClick={() => router.push(`/${params.slug}/book/payment`)}
            className="btn-primary px-12"
          >
            Continue to Payment →
          </button>
        </div>
      </div>
    </>
  );
}
