"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { calculateTenantPrice, getSqftTier } from "@/lib/catalogUtils";
import StepProgress from "@/components/booking/StepProgress";

export default function TenantReviewPage() {
  const params = useParams();
  const router = useRouter();
  const store  = useBookingStore();
  const {
    packageId, serviceIds, addonIds, address, city, state, zip,
    squareFootage, propertyType, notes, travelFee, setTravelFee, setPricing, pricing,
    promoCode, discount, setPromo, clearPromo,
  } = store;

  const [catalog,       setCatalog]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [promoInput,    setPromoInput]    = useState(promoCode || "");
  const [promoMsg,      setPromoMsg]      = useState(promoCode ? { text: discount > 0 ? `Code applied — $${discount} off` : "Code applied", ok: true } : null);
  const [promoLoading,  setPromoLoading]  = useState(false);
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
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
          address && zip && store.tenantId
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
        const p = calculateTenantPrice(packageId, serviceIds, addonIds, fee, catalogRes, Number(squareFootage) || 0);
        setPricing(p);
      } finally {
        setLoading(false);
      }
    }
    loadAndPrice();
  }, []);

  // Build readable line items from catalog
  const pkgItem  = catalog?.packages?.find((p) => p.id === packageId);
  const svcItems = (serviceIds || []).map((id) => catalog?.services?.find((s) => s.id === id)).filter(Boolean);
  const adnItems = (addonIds   || []).map((id) => catalog?.addons?.find((a) => a.id === id)).filter(Boolean);

  if (loading) {
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

            {/* Property card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Property</p>
                <button onClick={() => router.push(`/${params.slug}/book/property`)}
                  className="text-xs text-navy hover:underline">Edit</button>
              </div>
              <p className="font-medium text-charcoal">{fullAddress}</p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="capitalize">{propertyType || "Residential"}</span>
                {squareFootage && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>{Number(squareFootage).toLocaleString()} sq ft</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-navy font-medium">{tier} tier</span>
                  </>
                )}
              </div>
              {notes && (
                <p className="text-sm text-gray-400 mt-2 italic border-t border-gray-100 pt-2">
                  "{notes}"
                </p>
              )}
            </div>

            {/* Services card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Services</p>
                <button onClick={() => router.push(`/${params.slug}/book`)}
                  className="text-xs text-navy hover:underline">Edit</button>
              </div>
              <div className="space-y-2">
                {pkgItem && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{pkgItem.name}</p>
                      {pkgItem.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{pkgItem.description}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-navy flex-shrink-0 ml-4">
                      ${pricing?.base?.toLocaleString()}
                    </p>
                  </div>
                )}
                {svcItems.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                    </div>
                    <p className="text-sm font-semibold text-navy flex-shrink-0 ml-4">
                      ${pricing?.base?.toLocaleString()}
                    </p>
                  </div>
                ))}
                {adnItems.length > 0 && (
                  <div className="border-t border-dashed border-gray-100 pt-2 mt-2 space-y-1.5">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Add-ons</p>
                    {adnItems.map((a) => (
                      <div key={a.id} className="flex items-center justify-between">
                        <p className="text-sm text-charcoal">{a.name}</p>
                        <p className="text-sm text-navy font-medium flex-shrink-0 ml-4">
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
                    <span className="text-navy">${(pricing.finalTotal ?? pricing.subtotal)?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gold-dark font-semibold">
                    <span>Deposit (50%)</span>
                    <span>${(pricing.deposit ?? 0)?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Due at delivery</span>
                    <span>${(pricing.balance ?? 0)?.toLocaleString()}</span>
                  </div>
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

                {squareFootage && (
                  <div className="mt-4 bg-navy/4 rounded-xl p-3 text-xs text-gray-500">
                    Pricing based on <span className="font-medium text-navy">{tier} tier</span>
                    {" "}({Number(squareFootage).toLocaleString()} sq ft)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button onClick={() => router.push(`/${params.slug}/book/property`)} className="btn-outline">← Back</button>
          <button
            onClick={() => router.push(`/${params.slug}/book/schedule`)}
            className="btn-primary px-12"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
