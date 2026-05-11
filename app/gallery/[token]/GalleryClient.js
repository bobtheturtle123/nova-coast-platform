"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { formatPrice } from "@/lib/pricing";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ── Premium Lightbox ──────────────────────────────────────────────────────────
function Lightbox({ photos, startIndex, onClose, isUnlocked }) {
  const [idx, setIdx] = useState(startIndex);
  const thumbsRef = useRef(null);

  const prev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  useEffect(() => {
    const el = thumbsRef.current?.querySelector(`[data-t="${idx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  const photo = photos[idx];

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex flex-col select-none" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 bg-black/60 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          {photo?.category && (
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/35 truncate">{photo.category}</span>
          )}
        </div>
        <span className="text-xs text-white/30 font-mono tabular-nums flex-shrink-0 mx-4">
          {idx + 1} <span className="text-white/15">/</span> {photos.length}
        </span>
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main image */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden px-16" onClick={e => e.stopPropagation()}>
        <button onClick={prev}
          className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/50 border border-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 hover:border-white/20 transition-all backdrop-blur-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img
          key={idx}
          src={photo?.url}
          alt={photo?.fileName || `Photo ${idx + 1}`}
          className="max-h-full max-w-full object-contain select-none"
          style={{ maxHeight: "calc(100vh - 160px)" }}
          draggable={false}
          onContextMenu={isUnlocked ? undefined : e => e.preventDefault()}
          onClick={e => e.stopPropagation()}
        />
        <button onClick={next}
          className="absolute right-3 z-10 w-10 h-10 rounded-full bg-black/50 border border-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-black/80 hover:border-white/20 transition-all backdrop-blur-sm">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail strip */}
      <div ref={thumbsRef} onClick={e => e.stopPropagation()}
        className="flex-shrink-0 flex gap-2 px-4 py-3 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}>
        {photos.map((p, i) => (
          <button key={i} data-t={i} onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-[52px] h-[52px] rounded-lg overflow-hidden transition-all
              ${i === idx
                ? "ring-2 ring-[#c9a96e] ring-offset-1 ring-offset-black opacity-100"
                : "opacity-30 hover:opacity-60"
              }`}>
            <img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Payment form ──────────────────────────────────────────────────────────────
function BalancePaymentForm({ balance, onSuccess }) {
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
      <PaymentElement />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || loading}
        className="w-full py-3 rounded-xl bg-[#c9a96e] text-[#0F172A] font-semibold text-sm hover:bg-[#b8945a] transition-colors disabled:opacity-50">
        {loading ? "Processing…" : `Pay ${formatPrice(balance)} & Unlock`}
      </button>
    </form>
  );
}

function PaymentModal({ booking, onClose, onUnlock }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function initPayment() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-balance-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-[#0F172A] mb-1">Unlock Downloads</h2>
        <p className="text-sm text-gray-500 mb-6">Pay your remaining balance to unlock full-resolution downloads of all media.</p>
        {!clientSecret && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 flex items-center justify-between">
              <span className="text-sm text-gray-600">Balance due</span>
              <span className="font-bold text-[#0F172A]">{formatPrice(booking.remainingBalance)}</span>
            </div>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button onClick={initPayment} disabled={loading}
              className="w-full py-3 rounded-xl bg-[#3486cf] text-white font-semibold text-sm hover:bg-[#2a70b0] transition-colors disabled:opacity-50">
              {loading ? "Loading…" : "Continue to Payment"}
            </button>
          </>
        )}
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#3486cf" } } }}>
            <BalancePaymentForm balance={booking.remainingBalance} onSuccess={onUnlock} />
          </Elements>
        )}
      </div>
    </div>
  );
}

// ── Lock gate (full-tab) ──────────────────────────────────────────────────────
function LockGate({ label, balance, onPay }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/35">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div>
        <p className="text-white/60 font-medium mb-1">{label}</p>
        <p className="text-white/25 text-sm">Pay your balance to access all media</p>
      </div>
      {balance > 0 && (
        <button onClick={onPay}
          className="bg-[#c9a96e] text-[#0F172A] font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-[#b8945a] transition-colors">
          Pay {formatPrice(balance)} to Unlock
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GalleryClient({ gallery, booking }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isUnlocked, setIsUnlocked]   = useState(gallery.unlocked);

  // Support both new `media[]` structure and old `photos[]` structure
  const rawMedia = gallery.media?.length
    ? gallery.media.filter(m => !m.hidden)
    : (gallery.photos || []).map(p => ({ ...p, fileType: p.fileType || "image/jpeg" }));

  const photos    = rawMedia.filter(m => !m.fileType?.startsWith("video/") && !m.fileType?.includes("pdf"));
  const mediaVids = rawMedia.filter(m => m.fileType?.startsWith("video/"));

  // Support both new `matterportUrl` and old `matterportLinks[]`
  const matterportUrl = gallery.matterportUrl || gallery.matterportLinks?.[0]?.url || null;

  const hasVideo      = mediaVids.length > 0 || !!gallery.videoUrl;
  const hasMatterport = !!matterportUrl && !gallery.matterportHidden;
  const hasFloorPlans = (gallery.floorPlans || []).length > 0;
  const balance       = booking?.remainingBalance || 0;

  // Group photos by category
  const groups = {};
  photos.forEach((photo, i) => {
    const cat = photo.category || "";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ ...photo, _idx: i });
  });
  const groupKeys        = Object.keys(groups);
  const hasCategories    = groupKeys.some(k => k !== "");

  // Tabs — Video and 3D Tour are hidden entirely until paid
  const tabs = [
    photos.length > 0              && { id: "photos",     label: `Photos (${photos.length})` },
    hasVideo      && isUnlocked    && { id: "videos",     label: "Video" },
    hasMatterport && isUnlocked    && { id: "matterport", label: "3D Tour" },
    hasFloorPlans                  && { id: "floorplans", label: "Floor Plans" },
  ].filter(Boolean);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "photos");
  const openPayment = () => setShowPayment(true);

  return (
    <div className="min-h-screen bg-[#111113] text-white">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#111113]/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mb-0.5">Gallery</p>
          <h1 className="text-sm font-semibold text-white/90 truncate">{gallery.propertyAddress || "Your Gallery"}</h1>
        </div>
        {isUnlocked ? (
          photos.length > 0 && (
            <button
              onClick={() => photos.forEach((p, i) => {
                const a = document.createElement("a");
                a.href = p.url; a.download = p.fileName || `photo-${i + 1}.jpg`; a.target = "_blank";
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
              })}
              className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-xl bg-white/8 border border-white/10 hover:bg-white/12 transition-all flex-shrink-0 text-white/70 hover:text-white">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All
            </button>
          )
        ) : (
          balance > 0 && (
            <button onClick={openPayment}
              className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#c9a96e] text-[#0F172A] hover:bg-[#b8945a] transition-all flex-shrink-0">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Pay {formatPrice(balance)} to Unlock
            </button>
          )
        )}
      </header>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="border-b border-white/[0.06] px-5 flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0
                ${activeTab === t.id ? "border-[#c9a96e] text-white" : "border-transparent text-white/30 hover:text-white/55"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4 sm:p-6 lg:p-8">

        {/* ── Photos ─────────────────────────────────────────────────────── */}
        {activeTab === "photos" && (
          hasCategories ? (
            <div className="space-y-10">
              {groupKeys.map(catKey => {
                const catPhotos = groups[catKey];
                return (
                  <div key={catKey}>
                    {catKey !== "" && (
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/35">{catKey}</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-[10px] text-white/20 tabular-nums">{catPhotos.length}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                      {catPhotos.map((photo, i) => (
                        <div key={i} onClick={() => setLightboxIdx(photo._idx)}
                          onContextMenu={isUnlocked ? undefined : e => e.preventDefault()}
                          className="aspect-square overflow-hidden rounded-sm cursor-pointer group relative bg-white/5">
                          <img src={photo.url} alt="" loading="lazy" draggable={false}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 select-none" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
              {photos.map((photo, i) => (
                <div key={i} onClick={() => setLightboxIdx(i)}
                  onContextMenu={isUnlocked ? undefined : e => e.preventDefault()}
                  className="aspect-square overflow-hidden rounded-sm cursor-pointer group relative bg-white/5">
                  <img src={photo.url} alt="" loading="lazy" draggable={false}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 select-none" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Video ──────────────────────────────────────────────────────── */}
        {activeTab === "videos" && (
          !isUnlocked ? (
            <LockGate label="Video is locked until your balance is paid" balance={balance} onPay={openPayment} />
          ) : (
            <div className="max-w-4xl mx-auto space-y-5">
              {gallery.videoUrl && (
                <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src={gallery.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              {mediaVids.map((v, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
                  <video src={v.url} controls className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
          )
        )}

        {/* ── 3D Tour ────────────────────────────────────────────────────── */}
        {activeTab === "matterport" && (
          !isUnlocked ? (
            <LockGate label="3D tour is locked until your balance is paid" balance={balance} onPay={openPayment} />
          ) : (
            <div className="max-w-5xl mx-auto">
              <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ aspectRatio: "16/9" }}>
                <iframe src={matterportUrl} className="w-full h-full" allowFullScreen allow="xr-spatial-tracking" loading="lazy" title="3D Tour" />
              </div>
            </div>
          )
        )}

        {/* ── Floor Plans ────────────────────────────────────────────────── */}
        {activeTab === "floorplans" && (
          <div className="max-w-3xl mx-auto space-y-4">
            {(gallery.floorPlans || []).map((plan, i) => {
              const src   = plan.publicUrl || plan.url;
              const isPdf = plan.fileType?.includes("pdf") || src?.toLowerCase().endsWith(".pdf");
              const label = plan.fileName || `Floor Plan ${i + 1}`;
              return (
                <div key={i} className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.02]">
                  {isPdf ? (
                    <div className="p-5 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{label}</p>
                        <p className="text-xs text-white/25 mt-0.5">PDF</p>
                      </div>
                      {isUnlocked ? (
                        <a href={src} target="_blank" rel="noopener noreferrer" download
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 hover:bg-white/12 transition-all text-white/60 hover:text-white flex-shrink-0">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      ) : (
                        <button onClick={openPayment}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#c9a96e]/15 border border-[#c9a96e]/20 text-[#c9a96e] hover:bg-[#c9a96e]/25 transition-all flex-shrink-0">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          Locked
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Image — pointer-events off so the blocker div catches all mouse events */}
                      <img
                        src={src} alt={label}
                        className="w-full h-auto block select-none"
                        draggable={false}
                        style={{ userSelect: "none", WebkitUserSelect: "none", pointerEvents: "none" }}
                      />
                      {!isUnlocked ? (
                        <>
                          {/* Repeating diagonal PREVIEW ONLY watermark */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="100"><text transform="rotate(-30 110 50)" x="5" y="58" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.22)" letter-spacing="3">PREVIEW ONLY</text></svg>')}")`,
                              backgroundRepeat: "repeat",
                            }}
                          />
                          {/* Transparent blocker: catches right-click and drag */}
                          <div
                            className="absolute inset-0 z-10"
                            onContextMenu={e => e.preventDefault()}
                            onDragStart={e => e.preventDefault()}
                          />
                          {/* Lock badge top-right */}
                          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5">
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-[#c9a96e] flex-shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            <button onClick={openPayment} className="text-[10px] font-semibold text-[#c9a96e] hover:text-[#e8c080] transition-colors whitespace-nowrap">
                              Pay to download
                            </button>
                          </div>
                        </>
                      ) : null}
                      <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                        <p className="text-xs text-white/30 truncate">{label}</p>
                        {isUnlocked ? (
                          <a href={src} target="_blank" rel="noopener noreferrer" download
                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors flex-shrink-0 ml-4">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        ) : (
                          <span className="text-[10px] text-white/20 flex-shrink-0 ml-4">Preview only</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Premium Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} isUnlocked={isUnlocked} />
      )}

      {/* Payment modal */}
      {showPayment && booking && (
        <PaymentModal
          booking={booking}
          onClose={() => setShowPayment(false)}
          onUnlock={() => { setIsUnlocked(true); setShowPayment(false); }}
        />
      )}
    </div>
  );
}
