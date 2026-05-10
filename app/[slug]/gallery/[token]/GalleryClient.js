"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { getAppUrl } from "@/lib/appUrl";

// ── Gallery Lightbox ──────────────────────────────────────────────────────────
function GalleryLightbox({ images, startIndex, unlocked, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  const img = images[idx];

  return (
    <div className="fixed inset-0 z-[200] bg-black/96 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-5 text-white/50 hover:text-white text-3xl leading-none z-10">×</button>

      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl leading-none z-10 px-3 py-4">‹</button>
          <button onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl leading-none z-10 px-3 py-4">›</button>
        </>
      )}

      {/* Image + watermark wrapper */}
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={img?.url}
          alt={img?.fileName || `Photo ${idx + 1}`}
          draggable={false}
          onContextMenu={(e) => { if (!unlocked) e.preventDefault(); }}
          className="max-h-[90vh] max-w-[90vw] object-contain select-none"
          style={!unlocked ? { pointerEvents: "none" } : {}}
        />
        {/* Watermark — always shown when not unlocked */}
        {!unlocked && (
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}>
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 4 }).map((_, col) => (
                <span key={`${row}-${col}`}
                  className="absolute text-white/35 font-bold uppercase tracking-widest pointer-events-none select-none"
                  style={{
                    fontSize: "13px",
                    top: `${row * 18 + 4}%`,
                    left: `${col * 28 - 5}%`,
                    transform: "rotate(-30deg)",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.25em",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}>
                  PREVIEW ONLY
                </span>
              ))
            )}
          </div>
        )}
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">{idx + 1} / {images.length}</p>
    </div>
  );
}
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function BalanceForm({ clientSecret, balance, onSuccess, primary }) {
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
      <div className="p-4 border border-gray-200 rounded-xl">
        <PaymentElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || loading}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: primary, color: "#fff" }}>
        {loading ? "Processing…" : `Pay balance — $${balance}`}
      </button>
    </form>
  );
}

function downloadUrl(key, format, name) {
  const params = new URLSearchParams({ key, format, name: name || "image" });
  return `/api/gallery/download?${params}`;
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-white border border-white/60 hover:bg-white/10 transition-colors"
    >
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

function InlineCopyRow({ url, primary, label = "Copy Link" }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl">
      <span className="text-xs text-gray-400 flex-1 truncate font-mono">{url}</span>
      <button
        onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0 whitespace-nowrap">
        {copied ? "Copied!" : label}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 whitespace-nowrap"
        style={{ color: primary }}>
        Open ↗
      </a>
    </div>
  );
}

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}

export default function GalleryClient({ gallery, booking, tenant, slug, token }) {
  const [unlocked,     setUnlocked]     = useState(gallery.unlocked);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingPay,   setLoadingPay]   = useState(false);
  const [payMsg,       setPayMsg]       = useState("");
  const [lightboxIdx,  setLightboxIdx]  = useState(null);

  const primary = tenant.branding?.primaryColor || "#3486cf";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName;

  const allMedia  = (gallery.media || []).filter((m) => !m.hidden);
  const images    = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos    = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const balance   = booking?.remainingBalance ?? 0;
  const address   = booking?.fullAddress || booking?.address || "Property";
  const coverImg  = images[0]?.url || null;

  async function startBalancePayment() {
    setLoadingPay(true);
    try {
      const res = await fetch(`/api/${slug}/payment/create-balance-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: gallery.bookingId, galleryToken: token }),
      });
      const data = await res.json();
      if (data.clientSecret) setClientSecret(data.clientSecret);
      else setPayMsg(data.error || "Could not start payment.");
    } catch { setPayMsg("Something went wrong."); }
    finally { setLoadingPay(false); }
  }

  function handlePaySuccess() {
    setUnlocked(true);
    setClientSecret(null);
    setPayMsg("Payment successful! Downloads unlocked.");
  }

  const matterportUrl  = !gallery.matterportHidden ? (gallery.matterportUrl || null) : null;
  const videoUrl       = !gallery.videoUrlHidden   ? (gallery.videoUrl      || null) : null;
  const virtualLinks   = (gallery.virtualLinks  || []).filter((l) => !l.hidden);
  const floorPlans     = (gallery.floorPlans    || []).filter((fp) => !fp.hidden);
  const attachedFiles  = (gallery.attachedFiles || []).filter((f) => !f.hidden);
  const has3D          = matterportUrl || virtualLinks.length > 0;
  const hasExtras      = has3D || floorPlans.length > 0 || attachedFiles.length > 0;
  const hasVideos      = videos.length > 0 || !!videoUrl;

  // Convert YouTube/Vimeo watch URLs to embeddable URLs
  function toEmbedUrl(url) {
    if (!url) return null;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vi = url.match(/vimeo\.com\/(\d+)/);
    if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
    return url;
  }

  function fileDownloadUrl(key, name) {
    if (!key) return null;
    return `/api/gallery/download?${new URLSearchParams({ key, format: "raw", name: name || "file" })}`;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-60 md:h-80 bg-gray-900 overflow-hidden">
        {coverImg && (
          <img src={coverImg} alt={address}
            className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute top-4 left-5 right-5 flex items-center justify-between">
          <span className="font-display text-white text-base tracking-widest drop-shadow opacity-90">
            {name?.toUpperCase()}
          </span>
          {gallery.agentCanShare !== false && (
            <CopyLinkButton url={`${getAppUrl()}/${slug}/gallery/${token}`} />
          )}
        </div>
        <div className="absolute bottom-6 left-5 right-5">
          <h1 className="font-display text-white text-2xl md:text-4xl drop-shadow mb-2">{address}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {images.length > 0 && <span className="text-white/70 text-sm">{images.length} Photos</span>}
            {hasVideos && <span className="text-white/40 text-sm">·</span>}
            {hasVideos && <span className="text-white/70 text-sm">Video Tour</span>}
            {has3D && <span className="text-white/40 text-sm">·</span>}
            {has3D && <span className="text-white/70 text-sm">3D Tour</span>}
            {floorPlans.length > 0 && <span className="text-white/40 text-sm">·</span>}
            {floorPlans.length > 0 && <span className="text-white/70 text-sm">{floorPlans.length} Floor Plans</span>}
            {attachedFiles.length > 0 && <span className="text-white/40 text-sm">·</span>}
            {attachedFiles.length > 0 && <span className="text-white/70 text-sm">{attachedFiles.length} Documents</span>}
          </div>
        </div>
      </div>

      {/* ── MLS syndication bar ──────────────────────────────────────────── */}
      {booking?.propertyWebsite?.mlsSyndication && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-5 py-2.5 flex items-center gap-3 overflow-x-auto">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">View on</span>
            {[
              { label: "Zillow",       url: booking.propertyWebsite.zillowUrl   || (gallery.bookingAddress ? `https://www.zillow.com/homes/${encodeURIComponent(gallery.bookingAddress)}_rb/` : null) },
              { label: "Redfin",       url: booking.propertyWebsite.redfinUrl   || (gallery.bookingAddress ? `https://www.redfin.com/query/${encodeURIComponent(gallery.bookingAddress).replace(/%20/g, "+")}` : null) },
              { label: "Realtor.com",  url: booking.propertyWebsite.realtorUrl  || (gallery.bookingAddress ? `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(gallery.bookingAddress).replace(/%20/g, "-")}` : null) },
            ].filter((l) => l.url).map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 text-xs font-medium text-[#3486cf] border border-[#3486cf]/20 px-3 py-1 rounded-full hover:bg-[#3486cf]/5 transition-colors">
                {l.label} ↗
              </a>
            ))}
            {gallery.mlsUrl && (
              <a href={gallery.mlsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 text-xs font-semibold text-white bg-[#3486cf] px-3 py-1 rounded-full hover:bg-[#3486cf]/90 transition-colors">
                MLS Listing ↗
              </a>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* Preview notice */}
        {!unlocked && balance <= 0 && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>You're viewing a <strong>preview</strong>. Downloads are not available until the balance is paid.</span>
          </div>
        )}

        {/* Balance gate */}
        {!unlocked && balance > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
            <h2 className="font-display text-xl text-gray-900 mb-2">Unlock your media</h2>
            <p className="text-gray-500 text-sm mb-4">
              Pay your remaining balance of <strong>${balance}</strong> to download full-resolution files.
            </p>
            {payMsg && <p className="text-sm mb-4 text-blue-600">{payMsg}</p>}
            {!clientSecret && (
              <button onClick={startBalancePayment} disabled={loadingPay}
                className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: primary }}>
                {loadingPay ? "Loading…" : `Pay $${balance}`}
              </button>
            )}
            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret,
                appearance: { theme: "stripe", variables: { colorPrimary: primary } } }}>
                <BalanceForm clientSecret={clientSecret} balance={balance}
                  onSuccess={handlePaySuccess} primary={primary} />
              </Elements>
            )}
          </div>
        )}

        {payMsg && unlocked && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            {payMsg}
          </div>
        )}

        {/* ── Package overview (unlocked) ──────────────────────────────── */}
        {unlocked && (images.length > 0 || hasVideos || has3D || floorPlans.length > 0 || attachedFiles.length > 0) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Your Media Package</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                {images.length > 0 && <span>{images.length} photos</span>}
                {hasVideos && <><span className="text-gray-300">·</span><span>Video tour</span></>}
                {has3D && <><span className="text-gray-300">·</span><span>3D tour</span></>}
                {floorPlans.length > 0 && <><span className="text-gray-300">·</span><span>{floorPlans.length} floor plan{floorPlans.length !== 1 ? "s" : ""}</span></>}
                {attachedFiles.length > 0 && <><span className="text-gray-300">·</span><span>{attachedFiles.length} document{attachedFiles.length !== 1 ? "s" : ""}</span></>}
              </div>
            </div>
            <a
              href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web&extras=true`}
              download
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90"
              style={{ background: primary }}>
              ↓ Download Everything
            </a>
          </div>
        )}

        {/* ── Photos ──────────────────────────────────────────────────────── */}
        {images.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📷</p>
            <p className="text-sm">Your gallery is being prepared. Check back soon.</p>
          </div>
        ) : (
          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="font-semibold text-gray-900">Photos</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{images.length}</span>
              </div>
              {unlocked && (
                <div className="flex gap-2">
                  <a href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=print`}
                    download
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    ↓ Print
                  </a>
                  <a href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web`}
                    download
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: primary }}>
                    ↓ Web / MLS
                  </a>
                </div>
              )}
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {images.map((m, i) => (
                <div key={i} className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer"
                  onClick={() => setLightboxIdx(i)}>
                  <img src={m.url} alt={m.fileName || `Photo ${i + 1}`} draggable={false}
                    loading={i < 12 ? "eager" : "lazy"}
                    decoding="async"
                    onContextMenu={(e) => { if (!unlocked) e.preventDefault(); }}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 select-none"
                    style={!unlocked ? { pointerEvents: "none" } : {}} />

                  {!unlocked && (
                    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden"
                      style={{ userSelect: "none", WebkitUserSelect: "none" }}>
                      {Array.from({ length: 5 }).map((_, row) =>
                        Array.from({ length: 3 }).map((_, col) => (
                          <span key={`${row}-${col}`}
                            className="absolute text-white/40 font-bold uppercase tracking-widest pointer-events-none select-none"
                            style={{ fontSize: "9px", top: `${row * 22 + 8}%`, left: `${col * 38 - 8}%`,
                              transform: "rotate(-30deg)", whiteSpace: "nowrap", letterSpacing: "0.2em",
                              textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                            PREVIEW ONLY
                          </span>
                        ))
                      )}
                      <div className="absolute inset-0 bg-black/10" />
                    </div>
                  )}

                  {unlocked && m.key && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <p className="text-white text-[11px] font-medium text-center truncate w-full px-2">{m.fileName}</p>
                      <div className="flex gap-1.5">
                        <a href={downloadUrl(m.key, "print", m.fileName)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#3486cf]"
                          download onClick={(e) => e.stopPropagation()}>Print</a>
                        <a href={downloadUrl(m.key, "web", m.fileName)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#c4974a]"
                          download onClick={(e) => e.stopPropagation()}>Web</a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Video Tour ──────────────────────────────────────────────────── */}
        {hasVideos && (
          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Video Tour</h2>
            </div>
            <div className="p-4 space-y-3">
              {videoUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/9" }}>
                    <iframe src={toEmbedUrl(videoUrl)} title="Video Tour"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen className="w-full h-full" style={{ minHeight: 280 }} />
                  </div>
                  <InlineCopyRow url={videoUrl} primary={primary} />
                </div>
              )}
              {videos.length > 0 && (
                <div className={`grid gap-3 ${videos.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {videos.map((v, i) => (
                    <div key={i} className="rounded-xl overflow-hidden bg-gray-900 aspect-video relative group">
                      <video src={v.url} className="w-full h-full" controls />
                      {unlocked && v.key && (
                        <a
                          href={`/api/gallery/video-download?token=${gallery.accessToken}&key=${encodeURIComponent(v.key)}&name=${encodeURIComponent(v.fileName || "video.mp4")}`}
                          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg"
                          style={{ background: primary }}>
                          ↓ Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── 3D Tour ─────────────────────────────────────────────────────── */}
        {has3D && (
          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">3D Tour</h2>
            </div>
            <div className="p-4 space-y-3">
              {matterportUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/9" }}>
                    <iframe src={matterportUrl} title="3D Interactive Tour"
                      allow="xr-spatial-tracking" allowFullScreen
                      className="w-full h-full" style={{ minHeight: 360 }} />
                  </div>
                  <InlineCopyRow url={matterportUrl} primary={primary} label="Copy Tour Link" />
                </div>
              )}
              {virtualLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: primary + "18" }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: primary }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <span className="font-medium text-sm text-gray-900 flex-1">{l.label}</span>
                  <div className="flex gap-2 flex-shrink-0">
                    <CopyUrlButton url={l.url} />
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                      style={{ color: primary }}>
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Floor Plans ─────────────────────────────────────────────────── */}
        {floorPlans.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <h2 className="font-semibold text-gray-900">Floor Plans</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{floorPlans.length}</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {floorPlans.map((fp, i) => {
                const viewUrl = fp.publicUrl || fp.url;
                const dlUrl   = fp.key ? fileDownloadUrl(fp.key, fp.fileName) : viewUrl;
                return (
                  <div key={i} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50/50">
                    {fp.fileType?.includes("pdf") ? (
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-10 h-12 bg-red-50 border border-red-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[8px] font-bold text-red-400 uppercase">PDF</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{fp.fileName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Floor Plan</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {viewUrl && (
                            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors">
                              View
                            </a>
                          )}
                          {dlUrl && (
                            <a href={dlUrl} download={fp.fileName}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                              style={{ background: primary }}>
                              ↓ Download
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {viewUrl && (
                          <img src={viewUrl} alt={fp.fileName}
                            className="w-full object-contain max-h-80 bg-white" />
                        )}
                        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100 bg-white gap-2">
                          <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{fp.fileName}</span>
                          {fp.key && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <a href={downloadUrl(fp.key, "print", fp.fileName)} download
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#3486cf] transition-opacity hover:opacity-90">
                                Print
                              </a>
                              <a href={downloadUrl(fp.key, "web", fp.fileName)} download
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#c4974a] transition-opacity hover:opacity-90">
                                Web
                              </a>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Documents ───────────────────────────────────────────────────── */}
        {attachedFiles.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <h2 className="font-semibold text-gray-900">Documents</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{attachedFiles.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {attachedFiles.map((f, i) => {
                const viewUrl = f.publicUrl || f.url;
                const dlUrl   = f.key ? fileDownloadUrl(f.key, f.fileName) : viewUrl;
                const ext     = (f.fileName?.match(/\.([^.]+)$/) || [])[1]?.toUpperCase() || "FILE";
                const isPdf   = f.fileType?.includes("pdf");
                const isImage = f.fileType?.startsWith("image/");
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isPdf ? "bg-red-50 border-red-100" : "bg-gray-100 border-gray-200"
                    }`}>
                      <span className={`text-[9px] font-bold ${isPdf ? "text-red-500" : "text-gray-400"}`}>{ext}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{f.fileName}</span>
                    <div className="flex gap-2 flex-shrink-0">
                      {(isPdf || isImage) && viewUrl && (
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                          View
                        </a>
                      )}
                      {dlUrl && (
                        <a href={dlUrl} download={f.fileName}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                          style={{ background: primary }}>
                          ↓ Download
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-xs text-gray-400">
          Delivered by <span className="font-semibold" style={{ color: primary }}>{name}</span>
        </p>
      </footer>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <GalleryLightbox
          images={images}
          startIndex={lightboxIdx}
          unlocked={unlocked}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
