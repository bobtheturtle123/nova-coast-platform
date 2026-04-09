"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ─── Stripe payment form ──────────────────────────────────────────────────────
function PaymentForm({ deposit, onSuccess }) {
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
      confirmParams: { return_url: window.location.origin },
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
        <div className="bg-red-50 border border-red-200 rounded-sm p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button type="submit" disabled={!stripe || loading}
        className="btn-gold w-full py-4 text-base relative">
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Processing…
            </span>
          : `Pay deposit — $${deposit?.toLocaleString()}`}
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
function OrderSummary({ pricing, catalog, packageId, serviceIds, addonIds, address, city }) {
  if (!pricing || !catalog) return null;

  const pkgItem = packageId && catalog.packages?.find((p) => p.id === packageId);
  const services = (serviceIds || [])
    .map((id) => catalog.services?.find((s) => s.id === id))
    .filter(Boolean);
  const addons = (addonIds || [])
    .map((id) => catalog.addons?.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="card sticky top-6 space-y-4">
      <p className="font-semibold text-charcoal text-sm uppercase tracking-wider">Order Summary</p>

      {/* Property */}
      {address && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-3">
          <p className="font-medium text-charcoal truncate">{address}</p>
          {city && <p className="text-gray-400">{city}</p>}
        </div>
      )}

      {/* Line items */}
      <div className="space-y-2 text-sm">
        {pkgItem && (
          <div className="flex justify-between gap-2">
            <span className="text-charcoal font-medium flex-1">{pkgItem.name}</span>
            <span className="text-navy font-semibold flex-shrink-0">${pricing.base?.toLocaleString()}</span>
          </div>
        )}
        {services.map((s) => (
          <div key={s.id} className="flex justify-between gap-2">
            <span className="text-charcoal flex-1">{s.name}</span>
            <span className="text-navy flex-shrink-0">${pricing.base?.toLocaleString()}</span>
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

      {/* Totals */}
      <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="text-navy">${pricing.subtotal?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gold-dark font-medium">
          <span>Deposit today (50%)</span>
          <span>${pricing.deposit?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Due at delivery</span>
          <span>${pricing.balance?.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-cream rounded-sm p-3 text-xs text-gray-500 leading-relaxed">
        Booking shows as <span className="font-semibold text-navy">Requested</span> until confirmed.
        Remaining balance is due when media is delivered.
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
    pricing, packageId, serviceIds, addonIds,
    address, city, state, zip, squareFootage, propertyType, notes,
    preferredDate, preferredTime, travelFee,
    clientName, clientEmail, clientPhone,
    setClientInfo, setBookingResult,
  } = store;

  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId,    setBookingId]     = useState(null);
  const [initLoading,  setInitLoading]   = useState(false); // prevents double-submit race condition
  const [initError,    setInitError]     = useState(null);
  const [lookupState,  setLookupState]   = useState(null); // null | "found" | "new"
  const [catalog,      setCatalog]       = useState(null);
  const [fieldErrors,  setFieldErrors]   = useState({});

  const deposit = pricing?.deposit ?? 0;

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
  }, [clientEmail, clientName, clientPhone, params.slug, setClientInfo]);

  function validate() {
    const errs = {};
    if (!clientName.trim())                      errs.clientName  = "Name is required";
    if (!clientEmail.includes("@"))              errs.clientEmail = "Valid email is required";
    if (clientPhone.replace(/\D/g,"").length < 10) errs.clientPhone = "10-digit phone required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function initPayment() {
    if (!validate() || clientSecret || initLoading) return; // guard against double-submit
    setInitLoading(true);
    setInitError(null);
    try {
      const res = await fetch(`/api/${params.slug}/bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId, serviceIds, addonIds,
          address, city, state, zip, squareFootage, propertyType, notes,
          preferredDate, preferredTime,
          clientName, clientEmail, clientPhone,
          travelFee, pricing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking");
      setBookingId(data.bookingId);
      setClientSecret(data.clientSecret);
    } catch (err) {
      setInitError(err.message);
    } finally {
      setInitLoading(false);
    }
  }

  function handleSuccess() {
    setBookingResult(bookingId);
    router.push(`/${params.slug}/book/confirmation?bookingId=${bookingId}`);
  }

  return (
    <>
      <StepProgress current={6} />
      <div className="step-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left — client info + payment */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="section-label mb-2">Step 6 of 6</p>
              <h1 className="font-display text-4xl text-navy mb-3">Almost there.</h1>
              <p className="font-body text-gray-500">Enter your contact info, then pay your 50% deposit to confirm.</p>
            </div>

            {/* Contact info card */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-charcoal text-sm uppercase tracking-wider">Your Information</p>
                {lookupState === "found" && (
                  <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-sm font-medium">
                    Welcome back!
                  </span>
                )}
              </div>

              {/* Email first — drives agent lookup */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1.5">
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
                <label className="block text-sm font-medium text-charcoal mb-1.5">
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
                <label className="block text-sm font-medium text-charcoal mb-1.5">
                  Phone <span className="text-red-400">*</span>
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

              {!clientSecret && (
                <button onClick={initPayment} disabled={initLoading} className="btn-primary w-full mt-2">
                  {initLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating booking…
                      </span>
                    : "Proceed to Payment →"}
                </button>
              )}
              {initError && (
                <div className="bg-red-50 border border-red-200 rounded-sm p-3">
                  <p className="text-sm text-red-700">{initError}</p>
                </div>
              )}
            </div>

            {/* Stripe payment section */}
            {clientSecret && (
              <div className="card">
                <p className="font-semibold text-charcoal text-sm uppercase tracking-wider mb-4">Payment</p>
                <Elements stripe={stripePromise} options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary:      "#0b2a55",
                      fontFamily:        "DM Sans, sans-serif",
                      borderRadius:      "2px",
                      colorBackground:   "#ffffff",
                    },
                  },
                }}>
                  <PaymentForm deposit={deposit} onSuccess={handleSuccess} />
                </Elements>
              </div>
            )}
          </div>

          {/* Right — order summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              pricing={pricing}
              catalog={catalog}
              packageId={packageId}
              serviceIds={serviceIds}
              addonIds={addonIds}
              address={address}
              city={city}
            />
          </div>
        </div>

        <div className="mt-6">
          <button onClick={() => router.push(`/${params.slug}/book/schedule`)} className="btn-outline">
            ← Back
          </button>
        </div>
      </div>
    </>
  );
}
