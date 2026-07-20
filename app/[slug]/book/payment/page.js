"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";
import { depositLabel, getItemPrice } from "@/lib/catalogUtils";
import { getAppUrl } from "@/lib/appUrl";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ─── Stripe payment form ──────────────────────────────────────────────────────
function PaymentForm({ chargeAmount, payLabel, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${getAppUrl()}` },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") onSuccess(paymentIntent.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card">
        <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button type="submit" disabled={!stripe || loading}
        className="btn-gold w-full py-4 text-base relative">
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
              Processing…
            </span>
          : `${payLabel} — $${chargeAmount?.toLocaleString()}`}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Secured by Stripe · Your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ─── Phone number formatter ───────────────────────────────────────────────────
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4)  return digits;
  if (digits.length < 7)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

// ─── Order summary line items ─────────────────────────────────────────────────
function OrderSummary({ pricing, catalog, packageIds, serviceIds, addonIds, address, city, payFull, tip, partner }) {
  if (!pricing || !catalog) return null;
  const depLabel = depositLabel(catalog?.bookingConfig?.deposit);
  const promoDiscount   = pricing.discount || 0;
  // Partner pricing and a promo code don't stack — the better one wins.
  const partnerDiscount = partner?.discount || 0;
  const usePartner      = partnerDiscount > promoDiscount;
  const discount        = usePartner ? partnerDiscount : promoDiscount;
  const effectiveTotal  = usePartner
    ? Math.max(0, (pricing.subtotal ?? 0) - partnerDiscount)
    : (pricing.finalTotal ?? pricing.subtotal ?? 0);
  const effDeposit    = Math.min(pricing.deposit ?? 0, effectiveTotal);
  const effBalance    = Math.max(0, effectiveTotal - effDeposit);
  const totalCharge   = (payFull ? effectiveTotal : effDeposit) + (tip || 0);

  const pkgItems = (packageIds || [])
    .map((id) => catalog.packages?.find((p) => p.id === id))
    .filter(Boolean);
  const services = (serviceIds || [])
    .map((id) => catalog.services?.find((s) => s.id === id))
    .filter(Boolean);
  const addons = (addonIds || [])
    .map((id) => catalog.addons?.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="card sticky top-6 space-y-4">
      <p className="font-semibold text-[#0F172A] text-sm uppercase tracking-wider">Order Summary</p>

      {/* Property */}
      {address && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-3">
          <p className="font-medium text-[#0F172A] truncate">{address}</p>
          {city && <p className="text-gray-400">{city}</p>}
        </div>
      )}

      {/* Line items */}
      <div className="space-y-2 text-sm">
        {pkgItems.map((pkg) => (
          <div key={pkg.id} className="flex justify-between gap-2">
            <span className="text-[#0F172A] font-medium flex-1">{pkg.name}</span>
            <span className="text-[#3486cf] font-semibold flex-shrink-0">${getItemPrice(pkg, pricing?.tier).toLocaleString()}</span>
          </div>
        ))}
        {services.map((s) => (
          <div key={s.id} className="flex justify-between gap-2">
            <span className="text-[#0F172A] flex-1">{s.name}</span>
            <span className="text-[#3486cf] flex-shrink-0">${getItemPrice(s, pricing?.tier).toLocaleString()}</span>
          </div>
        ))}
        {addons.map((a) => (
          <div key={a.id} className="flex justify-between gap-2 text-gray-600">
            <span className="flex-1">+ {a.name}</span>
            <span className="flex-shrink-0">${a.price?.toLocaleString?.() ?? a.price}</span>
          </div>
        ))}
        {pricing.travelFee > 0 && (
          <div className="flex justify-between gap-2 text-gray-500">
            <span className="flex-1">Travel fee</span>
            <span className="flex-shrink-0">${pricing.travelFee?.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Tip */}
      {tip > 0 && (
        <div className="flex justify-between gap-2 text-gray-500 text-sm">
          <span className="flex-1">Tip</span>
          <span>${tip.toLocaleString()}</span>
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{usePartner ? `${partner.label} (${partner.percent}% off)` : "Promo discount"}</span>
            <span>−${discount.toLocaleString()}</span>
          </div>
        )}
        {usePartner && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
            You&apos;re saving ${discount.toLocaleString()} with your partner rate.
          </p>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="text-[#3486cf]">${effectiveTotal.toLocaleString()}</span>
        </div>
        {!payFull && effDeposit > 0 && (
          <>
            <div className="flex justify-between text-gold-dark font-medium">
              <span>{depLabel} today</span>
              <span>${effDeposit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Due at delivery</span>
              <span>${effBalance.toLocaleString()}</span>
            </div>
          </>
        )}
        {payFull && (
          <div className="flex justify-between text-green-700 font-medium">
            <span>Paying in full</span>
            <span>${effectiveTotal.toLocaleString()}</span>
          </div>
        )}
        {tip > 0 && (
          <div className="flex justify-between font-bold text-[#3486cf] border-t border-gray-100 pt-1.5">
            <span>Charged today</span>
            <span>${totalCharge?.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="bg-cream rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
        {payFull
          ? "Paid in full — media will be available for immediate download."
          : "Booking shows as Requested until confirmed. Remaining balance is due when media is delivered."}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TenantPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const store  = useBookingStore();

  const {
    pricing, packageIds, serviceIds, addonIds, retainerIds,
    address, unit, city, state, zip, squareFootage, propertyType, notes,
    preferredDate, preferredTime, preferredTimeSpecific, twilightTime, travelFee,
    clientName, clientEmail, clientPhone, customFields,
    photographerId, promoCode, promoId, discount,
    setClientInfo, setBookingResult,
  } = store;

  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId,    setBookingId]     = useState(null);
  const [initLoading,  setInitLoading]   = useState(false);
  const [initError,    setInitError]     = useState(null);
  const [paymentsDisabled, setPaymentsDisabled] = useState(false);
  const [lookupState,  setLookupState]   = useState(null);
  // Standing partner rate for this email, resolved on blur. Display only — the
  // booking route re-resolves it server-side before charging.
  const [partner,      setPartner]       = useState(null);
  const [catalog,      setCatalog]       = useState(null);
  const [fieldErrors,  setFieldErrors]   = useState({});
  const [payFull,      setPayFull]       = useState(false);
  const [tip,          setTip]           = useState(0);
  const [customTip,    setCustomTip]     = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [smsConsent,    setSmsConsent]    = useState(false);
  // Service agreement signing
  const [contractSignerName, setContractSignerName] = useState("");
  const [contractSigned,     setContractSigned]     = useState(false);
  const initLoadingRef = useRef(false);

  const depositConfig = catalog?.bookingConfig?.deposit;
  const noDeposit     = depositConfig?.type === "none";
  // If no deposit configured, force pay-in-full
  const effectivePayFull = payFull || noDeposit;
  // Use the discounted total when a promo is applied (finalTotal); fall back to
  // subtotal. Previously this charged subtotal, so promo codes were recorded but
  // never reduced the amount actually charged.
  // A partner rate overrides the promo when it saves more (they never stack).
  const promoTotal     = pricing?.finalTotal ?? pricing?.subtotal ?? 0;
  const partnerTotal   = Math.max(0, (pricing?.subtotal ?? 0) - (partner?.discount || 0));
  const effectiveTotal = partner?.discount ? Math.min(promoTotal, partnerTotal) : promoTotal;
  // Deposit can't exceed the discounted total.
  const deposit      = Math.min(pricing?.deposit ?? 0, effectiveTotal);
  const chargeAmount = (effectivePayFull ? effectiveTotal : deposit) + tip;

  // Load catalog for order summary
  useEffect(() => {
    fetch(`/api/tenant-public/${params.slug}/catalog`)
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => {});
  }, [params.slug]);

  // Look up agent by email on blur
  const handleEmailBlur = useCallback(async () => {
    const email = clientEmail.trim();
    if (!email.includes("@")) return;

    // Standing partner rate, if this agent (or their team) has one.
    fetch(`/api/${params.slug}/partner-discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, subtotal: pricing?.subtotal || 0 }),
    })
      .then((r) => r.json())
      .then((d) => setPartner(d.partner || null))
      .catch(() => setPartner(null));

    try {
      const res  = await fetch(`/api/${params.slug}/agents/lookup?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.agent) {
        setLookupState("found");
        setClientInfo({
          clientName:  data.agent.name  || clientName,
          clientPhone: data.agent.phone || clientPhone,
        });
      } else {
        setLookupState("new");
      }
    } catch {
      setLookupState("new");
    }
  }, [clientEmail, clientName, clientPhone, params.slug, setClientInfo, pricing?.subtotal]);

  function validate() {
    const errs = {};
    if (!clientName.trim())                                    errs.clientName  = "Name is required";
    if (!clientEmail.includes("@"))                            errs.clientEmail = "Valid email is required";
    const phoneDigits = clientPhone.replace(/\D/g, "").length;
    if (phoneDigits > 0 && phoneDigits < 10)                   errs.clientPhone = "Enter a valid 10-digit phone number";
    if (phoneDigits >= 10 && !smsConsent)                      errs.smsConsent  = "Please check the SMS consent box to continue.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function initPayment() {
    const hasTerms     = !!catalog?.bookingConfig?.terms;
    const hasAgreement = !!catalog?.bookingConfig?.serviceAgreement?.enabled;
    const valid = validate();
    if (hasTerms && !agreedToTerms) {
      setFieldErrors((e) => ({ ...e, terms: "You must agree to the Terms of Service to continue." }));
    }
    if (hasAgreement && !contractSigned) {
      setFieldErrors((e) => ({ ...e, contract: "Please read and sign the Service Agreement below to continue." }));
    }
    if (!valid || (hasTerms && !agreedToTerms) || (hasAgreement && !contractSigned) || clientSecret || initLoadingRef.current) return;
    initLoadingRef.current = true;
    setInitLoading(true);
    setInitError(null);
    try {
      const res = await fetch(`/api/${params.slug}/bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageIds, packageId: packageIds?.[0] ?? null, serviceIds, addonIds, retainerIds,
          address, unit, city, state, zip, squareFootage, propertyType, notes,
          preferredDate, preferredTime, preferredTimeSpecific, twilightTime,
          clientName, clientEmail, clientPhone,
          travelFee, pricing,
          payFull: effectivePayFull,
          tipAmount: tip,
          smsConsent,
          customFields: customFields || {},
          photographerId: photographerId || null,
          promoCode: promoCode || null, promoId: promoId || null, discount: discount || 0,
          contractSignerName: contractSigned ? contractSignerName.trim() : null,
        }),
      });
      const data = await res.json();
      if (data.code === "TENANT_PAYMENT_SETUP_INCOMPLETE") {
        // Studio can't accept online payments — show the safe message and
        // don't allow repeated submissions.
        setPaymentsDisabled(true);
        setInitError(data.error);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to create booking");
      setBookingId(data.bookingId);
      // Free / sub-minimum bookings have no payment to collect — skip Stripe and
      // go straight to confirmation.
      if (data.free || !data.clientSecret) {
        setBookingResult(data.bookingId, effectivePayFull);
        router.push(`/${params.slug}/book/confirmation?bookingId=${data.bookingId}`);
        return;
      }
      setClientSecret(data.clientSecret);
    } catch (err) {
      setInitError(err.message);
    } finally {
      initLoadingRef.current = false;
      setInitLoading(false);
    }
  }

  async function handleSuccess(paymentIntentId) {
    let paidInFull = effectivePayFull;
    try {
      const res = await fetch("/api/bookings/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, paymentIntentId }),
      });
      if (res.ok) {
        const data = await res.json();
        paidInFull = data.paidInFull ?? effectivePayFull;
      }
    } catch { /* webhook will still catch up */ }
    setBookingResult(bookingId, paidInFull);
    router.push(`/${params.slug}/book/confirmation?bookingId=${bookingId}`);
  }

  return (
    <>
      <StepProgress current={6} />
      <div className="max-w-6xl mx-auto px-6 py-10 animate-fade-up">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          {/* Left — client info + payment */}
          <div className="space-y-6">
            <div>
              <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8843F", background: "#F7F0E2", padding: "5px 12px", borderRadius: 99, marginBottom: 14 }}>Step 6 · Deposit</span>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#181B20", lineHeight: 1.1 }} className="mb-2">Almost there</h1>
              <p className="font-body text-gray-500">Enter your contact info to confirm your booking.</p>
            </div>

            {/* Contact info card */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#0F172A] text-sm uppercase tracking-wider">Your Information</p>
                {lookupState === "found" && (
                  <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-xl font-medium">
                    Welcome back!
                  </span>
                )}
              </div>

              {/* Email first — drives agent lookup */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => { setClientInfo({ clientEmail: e.target.value }); setLookupState(null); }}
                  onBlur={handleEmailBlur}
                  placeholder="jane@example.com"
                  className={`input-field ${fieldErrors.clientEmail ? "border-red-300" : ""}`}
                  disabled={!!clientSecret}
                />
                {fieldErrors.clientEmail && <p className="text-xs text-red-500 mt-1">{fieldErrors.clientEmail}</p>}
                {lookupState === "new" && (
                  <p className="text-xs text-gray-400 mt-1">First time? We'll save your info for next time.</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientInfo({ clientName: e.target.value })}
                  placeholder="Jane Smith"
                  className={`input-field ${fieldErrors.clientName ? "border-red-300" : ""}`}
                  disabled={!!clientSecret}
                />
                {fieldErrors.clientName && <p className="text-xs text-red-500 mt-1">{fieldErrors.clientName}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientInfo({ clientPhone: formatPhone(e.target.value) })}
                  placeholder="(619) 555-0100"
                  className={`input-field ${fieldErrors.clientPhone ? "border-red-300" : ""}`}
                  disabled={!!clientSecret}
                />
                {fieldErrors.clientPhone && <p className="text-xs text-red-500 mt-1">{fieldErrors.clientPhone}</p>}
              </div>

              {/* SMS consent — always visible per Twilio compliance */}
              <div className="space-y-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => {
                      setSmsConsent(e.target.checked);
                      if (e.target.checked) setFieldErrors((err) => { const n = { ...err }; delete n.smsConsent; return n; });
                    }}
                    disabled={!!clientSecret}
                    className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-gray-300 text-[#3486cf] focus:ring-navy"
                  />
                  <span className="text-sm text-gray-600">
                    I agree to receive SMS text messages from KyoriaOS related to bookings, appointment reminders, and media delivery notifications.
                  </span>
                </label>
                <p className="text-xs text-gray-400 ml-7">
                  Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance.
                </p>
                {fieldErrors.smsConsent && (
                  <p className="text-xs text-red-500 ml-7">{fieldErrors.smsConsent}</p>
                )}
              </div>

              {!clientSecret && (
                <>
                  {/* Pay in full toggle — only shown when deposit is configured */}
                  {!noDeposit && deposit > 0 && deposit < (pricing?.subtotal ?? 0) && (
                    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment option</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPayFull(false)}
                          className={`flex-1 py-2.5 px-3 border rounded-xl text-sm font-medium transition-colors ${
                            !payFull ? "border-[#3486cf] bg-[#3486cf]/5 text-[#3486cf]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>
                          {depositLabel(depositConfig)} — ${deposit?.toLocaleString()}
                        </button>
                        <button type="button" onClick={() => setPayFull(true)}
                          className={`flex-1 py-2.5 px-3 border rounded-xl text-sm font-medium transition-colors ${
                            payFull ? "border-[#3486cf] bg-[#3486cf]/5 text-[#3486cf]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>
                          Pay in full — ${pricing?.subtotal?.toLocaleString()}
                        </button>
                      </div>
                      {payFull && (
                        <p className="text-xs text-green-700">
                          Paying in full means your media will be available for download immediately.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tip selector */}
                  <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Add a tip <span className="font-normal text-gray-400">(optional)</span>
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 25, 50, 100].map((amt) => (
                        <button key={amt} type="button" onClick={() => { setTip(amt); setCustomTip(""); }}
                          className={`px-3 py-1.5 border rounded-xl text-sm transition-colors ${
                            tip === amt && customTip === ""
                              ? "border-[#3486cf] bg-[#3486cf]/5 text-[#3486cf] font-medium"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}>
                          {amt === 0 ? "None" : `$${amt}`}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-400">$</span>
                        <input
                          type="number" min="1" placeholder="Custom"
                          value={customTip}
                          onChange={(e) => {
                            setCustomTip(e.target.value);
                            const v = Number(e.target.value) || 0;
                            setTip(v);
                          }}
                          className="input-field py-1.5 w-20 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terms agreement checkbox */}
                  {catalog?.bookingConfig?.terms && (
                    <div className="space-y-1">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreedToTerms}
                          onChange={(e) => {
                            setAgreedToTerms(e.target.checked);
                            if (e.target.checked) setFieldErrors((err) => { const n = { ...err }; delete n.terms; return n; });
                          }}
                          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-gray-300 text-[#3486cf] focus:ring-navy"
                        />
                        <span className="text-sm text-gray-600">
                          I agree to the{" "}
                          <a href={`/${params.slug}/terms`} target="_blank" rel="noopener noreferrer"
                            className="text-[#3486cf] underline underline-offset-2 hover:opacity-70">
                            Terms of Service
                          </a>
                          {" "}and{" "}
                          <a href={`/${params.slug}/privacy`} target="_blank" rel="noopener noreferrer"
                            className="text-[#3486cf] underline underline-offset-2 hover:opacity-70">
                            Privacy Policy
                          </a>.
                        </span>
                      </label>
                      {fieldErrors.terms && (
                        <p className="text-xs text-red-500 ml-7">{fieldErrors.terms}</p>
                      )}
                    </div>
                  )}

                  {/* Service Agreement signing */}
                  {catalog?.bookingConfig?.serviceAgreement?.enabled && (
                    <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Agreement</p>
                      {!contractSigned ? (
                        <>
                          <div className="h-48 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 font-mono leading-relaxed whitespace-pre-wrap">
                            {catalog.bookingConfig.serviceAgreement.text}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0F172A] mb-1.5">
                              Type your full name to sign <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={contractSignerName}
                              onChange={(e) => setContractSignerName(e.target.value)}
                              placeholder="Your full legal name"
                              className="input-field"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={!contractSignerName.trim()}
                            onClick={() => {
                              if (!contractSignerName.trim()) return;
                              setContractSigned(true);
                              setFieldErrors((e) => { const n = {...e}; delete n.contract; return n; });
                            }}
                            className="btn-primary w-full py-2.5">
                            I agree and electronically sign this agreement
                          </button>
                          {fieldErrors.contract && (
                            <p className="text-xs text-red-500">{fieldErrors.contract}</p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                          <span className="text-green-600 text-lg leading-none">✓</span>
                          <div>
                            <p className="text-sm font-medium text-green-800">Agreement signed</p>
                            <p className="text-xs text-green-700 mt-0.5">Signed as: <strong>{contractSignerName}</strong></p>
                            <button type="button" onClick={() => { setContractSigned(false); }}
                              className="text-xs text-green-600 underline mt-1">Undo</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentsDisabled ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
                      <p className="text-sm font-semibold text-amber-800">Online payment unavailable</p>
                      <p className="text-xs text-amber-700 mt-1">
                        This studio is temporarily unable to accept online payments. Please contact the studio directly to complete your booking.
                      </p>
                    </div>
                  ) : (
                    <button onClick={initPayment} disabled={initLoading} className="btn-primary w-full mt-2">
                      {initLoading
                        ? <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating booking…
                          </span>
                        : chargeAmount < 0.5
                          ? "Confirm Booking →"
                          : `Proceed to Payment — $${chargeAmount.toLocaleString()} →`}
                    </button>
                  )}
                </>
              )}
              {initError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{initError}</p>
                </div>
              )}
            </div>

            {/* Stripe payment section */}
            {clientSecret && (
              <div className="card">
                <p className="font-semibold text-[#0F172A] text-sm uppercase tracking-wider mb-4">Payment</p>
                <Elements stripe={stripePromise} options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary:      "#3486cf",
                      fontFamily:        "DM Sans, sans-serif",
                      borderRadius:      "2px",
                      colorBackground:   "#ffffff",
                    },
                  },
                }}>
                  <PaymentForm
                    chargeAmount={chargeAmount}
                    payLabel={effectivePayFull ? "Pay in full" : depositLabel(depositConfig)}
                    onSuccess={handleSuccess}
                  />
                </Elements>
              </div>
            )}
          </div>

          {/* Right — order summary */}
          <div>
            <OrderSummary
              pricing={pricing}
              catalog={catalog}
              packageIds={packageIds}
              serviceIds={serviceIds}
              addonIds={addonIds}
              address={address}
              city={city}
              payFull={effectivePayFull}
              tip={tip}
              partner={partner}
            />
          </div>
        </div>

        <div className="mt-6">
          <button onClick={() => router.push(`/${params.slug}/book/review`)} className="btn-outline">
            ← Back
          </button>
        </div>
      </div>
    </>
  );
}
