"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

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
      confirmParams: { return_url: window.location.origin },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }
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
      <button type="submit" disabled={!stripe || loading} className="btn-gold w-full py-4 text-base relative">
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Processing...
            </span>
          : `Pay deposit — $${deposit}`}
      </button>
      <p className="text-xs text-gray-400 text-center">Secured by Stripe · Your card details are never stored on our servers.</p>
    </form>
  );
}

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
  const [initError,    setInitError]     = useState(null);

  const deposit  = pricing?.deposit ?? 0;
  const infoValid = clientName.trim() && clientEmail.includes("@") && clientPhone.trim().length >= 10;

  async function initPayment() {
    if (!infoValid || clientSecret) return;
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
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="section-label mb-2">Step 6 of 6</p>
              <h1 className="font-display text-4xl text-navy mb-3">Almost there.</h1>
              <p className="font-body text-gray-500">Enter your contact info, then pay your 50% deposit to submit.</p>
            </div>

            <div className="card space-y-4">
              <p className="font-semibold text-charcoal text-sm uppercase tracking-wider">Your Information</p>
              {[
                { name: "clientName",  type: "text",  label: "Full Name",     placeholder: "Jane Smith" },
                { name: "clientEmail", type: "email", label: "Email",          placeholder: "jane@example.com" },
                { name: "clientPhone", type: "tel",   label: "Phone",          placeholder: "(619) 555-0100" },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-charcoal mb-1.5">
                    {f.label} <span className="text-red-400">*</span>
                  </label>
                  <input name={f.name} type={f.type} value={store[f.name]}
                    onChange={(e) => setClientInfo({ [f.name]: e.target.value })}
                    placeholder={f.placeholder} className="input-field" />
                </div>
              ))}
              {!clientSecret && (
                <button onClick={initPayment} disabled={!infoValid} className="btn-primary w-full mt-2">
                  Proceed to Payment
                </button>
              )}
              {initError && <p className="text-red-600 text-sm">{initError}</p>}
            </div>

            {clientSecret && (
              <div>
                <p className="font-semibold text-charcoal text-sm uppercase tracking-wider mb-3">Payment</p>
                <Elements stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "stripe",
                      variables: { colorPrimary: "#0b2a55", fontFamily: "DM Sans, sans-serif", borderRadius: "2px" },
                    },
                  }}>
                  <PaymentForm clientSecret={clientSecret} deposit={deposit} onSuccess={handleSuccess} />
                </Elements>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="card">
              <p className="section-label mb-4">Order Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total</span><span className="text-navy">${pricing?.subtotal ?? 0}</span>
                </div>
                <div className="flex justify-between text-gold-dark font-medium pt-2 border-t border-gray-100">
                  <span>Deposit today</span><span>${deposit}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Due at delivery</span><span>${pricing?.balance ?? 0}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 card bg-cream border-0">
              <p className="text-xs text-gray-500 leading-relaxed">
                Your booking will show as <span className="font-semibold text-navy">"Requested"</span> until confirmed.
                The remaining balance is due when your media is delivered.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={() => router.push(`/${params.slug}/book/schedule`)} className="btn-outline">← Back</button>
        </div>
      </div>
    </>
  );
}
