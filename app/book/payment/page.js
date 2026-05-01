"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useBookingStore } from "@/store/bookingStore";
import { formatPrice } from "@/lib/pricing";
import StepProgress from "@/components/booking/StepProgress";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ─── Inner payment form (must be inside <Elements>) ──────────────────────────
function PaymentForm({ clientSecret, deposit, onSuccess }) {
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
      confirmParams: {
        return_url: `${window.location.origin}/book/confirmation`,
      },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card">
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: { applePay: "auto", googlePay: "auto" },
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700 font-body">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-gold w-full py-4 text-base relative"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          `Pay deposit — ${formatPrice(deposit)}`
        )}
      </button>

      <p className="text-xs text-gray-400 font-body text-center">
        Secured by Stripe · Your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function PaymentPage() {
  const router = useRouter();
  const store  = useBookingStore();

  const {
    pricing, packageId, serviceIds, addonIds,
    address, city, state, zip,
    squareFootage, propertyType, notes,
    preferredDate, preferredTime,
    clientName, clientEmail, clientPhone,
    travelFee, setClientInfo, setBookingResult,
  } = store;

  const [clientSecret, setClientSecret] = useState(null);
  const [bookingId,    setBookingId]     = useState(null);
  const [initError,    setInitError]     = useState(null);
  const [formReady,    setFormReady]     = useState(false);

  const deposit = pricing?.deposit ?? 0;

  // Validate client info form
  const infoValid =
    clientName.trim() && clientEmail.includes("@") && clientPhone.trim().length >= 10;

  // Create booking + payment intent when client info is complete
  async function initPayment() {
    if (!infoValid || clientSecret) return;
    setInitError(null);

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId, serviceIds, addonIds,
          address, city, state, zip,
          squareFootage, propertyType, notes,
          preferredDate, preferredTime,
          clientName, clientEmail, clientPhone,
          travelFee,
          pricing,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking");

      setBookingId(data.bookingId);
      setClientSecret(data.clientSecret);
    } catch (err) {
      setInitError(err.message);
    }
  }

  function handleChange(e) {
    setClientInfo({ [e.target.name]: e.target.value });
  }

  function handleSuccess(paymentIntentId) {
    setBookingResult(bookingId);
    router.push(`/book/confirmation?bookingId=${bookingId}`);
  }

  return (
    <>
      <StepProgress current={6} />

      <div className="step-container">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: Forms */}
          <div className="lg:col-span-2 space-y-6">
            <div className="mb-2">
              <p className="section-label mb-2">Step 6 of 6</p>
              <h1 className="font-display text-4xl text-[#3486cf] mb-3">
                Almost there.
              </h1>
              <p className="font-body text-gray-500">
                Enter your contact info, then pay your 50% deposit to submit.
              </p>
            </div>

            {/* Contact info */}
            <div className="card space-y-4">
              <p className="font-body font-semibold text-[#0F172A] text-sm uppercase tracking-wider">
                Your Information
              </p>
              <div>
                <label className="block text-sm font-body font-medium text-[#0F172A] mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="clientName"
                  value={clientName}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-body font-medium text-[#0F172A] mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  name="clientEmail"
                  value={clientEmail}
                  onChange={handleChange}
                  type="email"
                  placeholder="jane@example.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-body font-medium text-[#0F172A] mb-1.5">
                  Phone <span className="text-red-400">*</span>
                </label>
                <input
                  name="clientPhone"
                  value={clientPhone}
                  onChange={handleChange}
                  type="tel"
                  placeholder="(619) 555-0100"
                  className="input-field"
                />
              </div>

              {!clientSecret && (
                <button
                  onClick={initPayment}
                  disabled={!infoValid}
                  className="btn-primary w-full mt-2"
                >
                  Proceed to Payment
                </button>
              )}

              {initError && (
                <p className="text-red-600 text-sm font-body">{initError}</p>
              )}
            </div>

            {/* Stripe payment form */}
            {clientSecret && (
              <div>
                <p className="font-body font-semibold text-[#0F172A] text-sm uppercase tracking-wider mb-3">
                  Payment
                </p>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "stripe",
                      variables: {
                        colorPrimary:    "#3486cf",
                        colorBackground: "#ffffff",
                        fontFamily:      "DM Sans, sans-serif",
                        borderRadius:    "2px",
                      },
                    },
                  }}
                >
                  <PaymentForm
                    clientSecret={clientSecret}
                    deposit={deposit}
                    onSuccess={handleSuccess}
                  />
                </Elements>
              </div>
            )}
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="card">
              <p className="section-label mb-4">Order Summary</p>
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-[#3486cf]">{formatPrice(pricing?.subtotal ?? 0)}</span>
                </div>
                <div className="flex justify-between text-gold-dark font-medium pt-2 border-t border-gray-100">
                  <span>Deposit today</span>
                  <span>{formatPrice(deposit)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Due at delivery</span>
                  <span>{formatPrice(pricing?.balance ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 card bg-cream border-0">
              <p className="text-xs font-body text-gray-500 leading-relaxed">
                Your booking will show as{" "}
                <span className="font-semibold text-[#3486cf]">"Requested"</span> until we
                confirm it. You won't be charged the remaining balance until your
                media is delivered.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-start mt-6">
          <button onClick={() => router.push("/book/schedule")} className="btn-outline">
            ← Back
          </button>
        </div>
      </div>
    </>
  );
}
