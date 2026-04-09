"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { formatPrice } from "@/lib/pricing";
import Image from "next/image";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ─── Payment Modal ────────────────────────────────────────────────────────────
function BalancePaymentForm({ clientSecret, balance, onSuccess }) {
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

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || loading} className="btn-gold w-full py-3">
        {loading ? "Processing..." : `Pay ${formatPrice(balance)} & Unlock Downloads`}
      </button>
    </form>
  );
}

function PaymentModal({ booking, onClose, onUnlock }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  async function initPayment() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-balance-intent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
        <h2 className="font-display text-2xl text-navy mb-2">Unlock Downloads</h2>
        <p className="text-sm text-gray-500 font-body mb-6">
          Pay your remaining balance to unlock full-resolution downloads of all your media.
        </p>

        {!clientSecret && (
          <>
            <div className="bg-cream rounded-sm p-4 mb-6">
              <div className="flex justify-between text-sm font-body">
                <span>Balance due</span>
                <span className="font-semibold text-navy">{formatPrice(booking.remainingBalance)}</span>
              </div>
            </div>
            {error && <p className="text-red-600 text-sm font-body mb-3">{error}</p>}
            <button onClick={initPayment} disabled={loading} className="btn-primary w-full">
              {loading ? "Loading..." : "Continue to Payment"}
            </button>
          </>
        )}

        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe", variables: { colorPrimary: "#0b2a55" } },
            }}
          >
            <BalancePaymentForm
              clientSecret={clientSecret}
              balance={booking.remainingBalance}
              onSuccess={onUnlock}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

// ─── Main Gallery Component ───────────────────────────────────────────────────
export default function GalleryClient({ gallery, booking }) {
  const [activeTab,     setActiveTab]     = useState("photos");
  const [lightboxIdx,   setLightboxIdx]   = useState(null);
  const [showPayment,   setShowPayment]   = useState(false);
  const [isUnlocked,    setIsUnlocked]    = useState(gallery.unlocked);

  const tabs = [
    gallery.photos?.length       && { id: "photos",     label: `Photos (${gallery.photos.length})` },
    gallery.videos?.length       && { id: "videos",     label: "Video" },
    gallery.matterportLinks?.length && { id: "matterport", label: "3D Tour" },
    gallery.floorPlans?.length   && { id: "floorplans", label: "Floor Plans" },
  ].filter(Boolean);

  function handleDownloadAll() {
    if (!isUnlocked) { setShowPayment(true); return; }
    gallery.photos?.forEach((photo, i) => {
      const a   = document.createElement("a");
      a.href    = photo.url;
      a.download = photo.filename || `photo-${i + 1}.jpg`;
      a.click();
    });
  }

  return (
    <div className="min-h-screen bg-charcoal text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-gold/80 text-xs font-body tracking-[0.2em] uppercase mb-0.5">
            Nova Coast Media
          </p>
          <h1 className="font-display text-lg text-white">{gallery.propertyAddress}</h1>
        </div>

        {/* Download button */}
        {gallery.photos?.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-body font-medium transition-all
              ${isUnlocked
                ? "bg-gold text-navy hover:bg-gold-dark"
                : "bg-white/10 text-white/60 border border-white/20 hover:bg-white/20"
              }`}
          >
            {isUnlocked ? (
              <>↓ Download All</>
            ) : (
              <>🔒 {booking ? `Pay ${formatPrice(booking.remainingBalance)} to Download` : "Locked"}</>
            )}
          </button>
        )}
      </header>

      {/* Locked banner */}
      {!isUnlocked && booking && (
        <div className="bg-amber-900/30 border-b border-amber-700/30 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-body text-amber-200">
            Downloads are locked. Pay your remaining balance of{" "}
            <strong>{formatPrice(booking.remainingBalance)}</strong> to unlock full access.
          </p>
          <button
            onClick={() => setShowPayment(true)}
            className="bg-gold text-navy text-xs font-semibold px-4 py-1.5 rounded-sm hover:bg-gold-dark ml-4 flex-shrink-0"
          >
            Pay & Unlock
          </button>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="border-b border-white/10 px-6 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-body border-b-2 transition-colors
                ${activeTab === t.id
                  ? "border-gold text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-6">

        {/* Photos grid */}
        {activeTab === "photos" && (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {gallery.photos?.map((photo, i) => (
              <div
                key={i}
                onClick={() => setLightboxIdx(i)}
                className="relative break-inside-avoid cursor-pointer overflow-hidden rounded-sm
                           group hover:opacity-90 transition-opacity"
              >
                <img
                  src={photo.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Videos */}
        {activeTab === "videos" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gallery.videos?.map((video, i) => (
              <div key={i} className="bg-white/5 rounded-sm overflow-hidden">
                <video
                  src={video.url}
                  controls
                  poster={video.thumbnailUrl}
                  className="w-full"
                />
                {video.title && (
                  <p className="p-3 text-sm font-body text-white/70">{video.title}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Matterport */}
        {activeTab === "matterport" && (
          <div className="space-y-4">
            {gallery.matterportLinks?.map((link, i) => (
              <div key={i}>
                <p className="text-sm font-body text-white/60 mb-2">{link.label || "3D Tour"}</p>
                <iframe
                  src={link.url}
                  className="w-full aspect-video rounded-sm"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        )}

        {/* Floor plans */}
        {activeTab === "floorplans" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gallery.floorPlans?.map((plan, i) => (
              <div key={i} className="bg-white/5 rounded-sm p-2">
                <img src={plan.url} alt={plan.filename} className="w-full h-auto" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(Math.max(0, lightboxIdx - 1))}
            className="absolute left-4 text-white/60 hover:text-white text-3xl px-4 py-2 z-10"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(Math.max(0, lightboxIdx - 1)); }}
          >
            ‹
          </button>
          <img
            src={gallery.photos[lightboxIdx]?.url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 text-white/60 hover:text-white text-3xl px-4 py-2 z-10"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(Math.min(gallery.photos.length - 1, lightboxIdx + 1)); }}
          >
            ›
          </button>
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
            onClick={() => setLightboxIdx(null)}
          >
            ×
          </button>
          <p className="absolute bottom-4 text-white/40 text-sm font-body">
            {lightboxIdx + 1} / {gallery.photos.length}
          </p>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && booking && (
        <PaymentModal
          booking={booking}
          onClose={() => setShowPayment(false)}
          onUnlock={() => {
            setIsUnlocked(true);
            setShowPayment(false);
          }}
        />
      )}
    </div>
  );
}
