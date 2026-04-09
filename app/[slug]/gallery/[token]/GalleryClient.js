"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function BalanceForm({ clientSecret, balance, onSuccess }) {
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
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (stripeError) { setError(stripeError.message); setLoading(false); return; }
    if (paymentIntent?.status === "succeeded") onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-sm">
        <PaymentElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || loading}
        className="w-full py-3 rounded-sm font-semibold text-sm transition-colors"
        style={{ background: "#c9a96e", color: "#0b2a55" }}>
        {loading ? "Processing…" : `Pay balance — $${balance}`}
      </button>
    </form>
  );
}

export default function GalleryClient({ gallery, booking, tenant, slug, token }) {
  const [unlocked,     setUnlocked]     = useState(gallery.unlocked);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingPay,   setLoadingPay]   = useState(false);
  const [payMsg,       setPayMsg]       = useState("");

  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName;

  const media = gallery.media || [];
  const balance = booking?.remainingBalance ?? 0;

  async function startBalancePayment() {
    setLoadingPay(true);
    try {
      const res = await fetch(`/api/${slug}/payment/create-balance-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: gallery.bookingId, galleryToken: token }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setPayMsg(data.error || "Could not start payment.");
      }
    } catch {
      setPayMsg("Something went wrong.");
    } finally {
      setLoadingPay(false);
    }
  }

  function handlePaySuccess() {
    setUnlocked(true);
    setClientSecret(null);
    setPayMsg("Payment successful! Downloads unlocked.");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-display text-lg tracking-wide" style={{ color: primary }}>
            {name?.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">Media Gallery</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Property info */}
        {booking && (
          <div className="mb-8">
            <h1 className="font-display text-2xl text-gray-900">{booking.fullAddress || booking.address}</h1>
            <p className="text-gray-500 text-sm mt-1">{media.length} items</p>
          </div>
        )}

        {/* Balance gate */}
        {!unlocked && balance > 0 && (
          <div className="bg-white rounded-sm border border-gray-200 p-6 mb-8 max-w-lg">
            <h2 className="font-display text-xl text-gray-900 mb-2">Unlock full downloads</h2>
            <p className="text-gray-500 text-sm mb-4">
              Pay your remaining balance of <strong>${balance}</strong> to download full-resolution files.
            </p>

            {payMsg && (
              <p className={`text-sm mb-4 ${unlocked ? "text-green-600" : "text-blue-600"}`}>{payMsg}</p>
            )}

            {!clientSecret && !unlocked && (
              <button onClick={startBalancePayment} disabled={loadingPay}
                className="py-2 px-6 rounded-sm font-semibold text-sm"
                style={{ background: primary, color: "#fff" }}>
                {loadingPay ? "Loading…" : `Pay $${balance}`}
              </button>
            )}

            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret,
                appearance: { theme: "stripe", variables: { colorPrimary: primary } } }}>
                <BalanceForm clientSecret={clientSecret} balance={balance} onSuccess={handlePaySuccess} />
              </Elements>
            )}
          </div>
        )}

        {/* Media grid */}
        {media.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📷</p>
            <p>Media is being processed. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((m, i) => (
              <div key={i} className="relative group aspect-square rounded-sm overflow-hidden bg-gray-200">
                {m.fileType?.startsWith("video/") ? (
                  <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={m.url} alt={m.fileName || `Photo ${i + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                )}
                {unlocked && (
                  <a href={m.url} download={m.fileName}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                    Download
                  </a>
                )}
                {!unlocked && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="text-white text-xl">🔒</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
