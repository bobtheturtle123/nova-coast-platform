"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { getAppUrl } from "@/lib/appUrl";

// ── Gallery Lightbox ──────────────────────────────────────────────────────────
function GalleryLightbox({ images, startIndex, unlocked, onClose }) {
  const [idx,    setIdx]    = useState(startIndex);
  const [loaded, setLoaded] = useState(false);

  const prev = () => { setLoaded(false); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = () => { setLoaded(false); setIdx((i) => (i + 1) % images.length); };

  useEffect(() => { setLoaded(false); }, [idx]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, onClose]);

  const img = images[idx];

  // SVG repeating watermark pattern — covers exactly the image, not the dark surround
  const watermarkBg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='90'%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial,sans-serif' font-size='13' font-weight='700' letter-spacing='3' fill='white' fill-opacity='0.22' transform='rotate(-25 110 45)'%3EPREVIEW ONLY%3C/text%3E%3C/svg%3E\")";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "rgba(10,10,12,0.97)" }} onClick={onClose}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
        <span className="text-white/50 text-sm tabular-nums font-medium">
          {idx + 1} <span className="text-white/25 mx-0.5">/</span> {images.length}
        </span>
        {img?.fileName && (
          <span className="text-white/30 text-xs truncate max-w-[40%] text-center hidden sm:block tracking-wide">
            {img.fileName}
          </span>
        )}
        <button onClick={onClose} aria-label="Close"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-sm transition-all select-none"
          style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.22)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Close
        </button>
      </div>

      {/* ── Image area ── */}
      <div className="flex-1 flex items-center justify-center min-h-0 relative" onClick={onClose}>

        {/* Left arrow */}
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Tight image wrapper — watermark clips to image bounds */}
        <div className="flex items-center justify-center w-full h-full px-16 sm:px-20" onClick={(e) => e.stopPropagation()}>
          <div className="relative" style={{ display: "inline-flex", maxWidth: "100%", maxHeight: "100%" }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.7)" }} />
              </div>
            )}
            <img
              key={img?.url}
              src={img?.url}
              alt={img?.fileName || `Photo ${idx + 1}`}
              draggable={false}
              onLoad={() => setLoaded(true)}
              onContextMenu={(e) => { if (!unlocked) e.preventDefault(); }}
              className="block select-none"
              style={{
                maxHeight: "calc(100vh - 160px)",
                maxWidth: "100%",
                objectFit: "contain",
                opacity: loaded ? 1 : 0,
                transition: "opacity 0.18s ease",
                pointerEvents: !unlocked ? "none" : undefined,
                boxShadow: loaded ? "0 8px 48px rgba(0,0,0,0.6)" : "none",
              }}
            />
            {/* Watermark — positioned over the image only */}
            {!unlocked && (
              <div className="absolute inset-0 pointer-events-none select-none"
                style={{
                  backgroundImage: watermarkBg,
                  backgroundRepeat: "repeat",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }} />
            )}
          </div>
        </div>

        {/* Right arrow */}
        {images.length > 1 && (
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.18)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-4 pb-4 pt-2 overflow-x-auto"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
          onClick={(e) => e.stopPropagation()}>
          {images.map((im, i) => (
            <button key={i} onClick={() => { setLoaded(false); setIdx(i); }}
              className="flex-shrink-0 overflow-hidden transition-all"
              style={{
                width: 52, height: 36,
                borderRadius: 6,
                outline: i === idx ? "2px solid rgba(255,255,255,0.8)" : "2px solid transparent",
                outlineOffset: 2,
                opacity: i === idx ? 1 : 0.4,
              }}>
              <img src={im.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
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
    if (paymentIntent?.status === "succeeded") onSuccess(paymentIntent.id);
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
  const [unlocked,        setUnlocked]        = useState(gallery.unlocked);
  const [clientSecret,    setClientSecret]    = useState(null);
  const [loadingPay,      setLoadingPay]      = useState(false);
  const [payMsg,          setPayMsg]          = useState("");
  const [lightboxIdx,     setLightboxIdx]     = useState(null);
  const [isAgentSignedIn, setIsAgentSignedIn] = useState(false);
  const [agentCheckDone,  setAgentCheckDone]  = useState(false);

  useEffect(() => {
    fetch(`/api/${slug}/agent/session`)
      .then(r => r.json())
      .then(d => { setIsAgentSignedIn(!!d.agent); setAgentCheckDone(true); })
      .catch(() => setAgentCheckDone(true));
  }, [slug]);

  // Block right-click on the entire page before payment
  useEffect(() => {
    if (!unlocked) {
      const prevent = (e) => e.preventDefault();
      document.addEventListener("contextmenu", prevent);
      return () => document.removeEventListener("contextmenu", prevent);
    }
  }, [unlocked]);

  const primary = tenant.branding?.primaryColor || "#3486cf";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName;

  const requireAgentPortal = !!tenant.bookingConfig?.requireAgentPortal;
  const canDownload        = unlocked && (!requireAgentPortal || isAgentSignedIn);
  // Wait for the session check before showing the callout — avoids a flash for signed-in agents.
  const showSignupCallout  = agentCheckDone && !isAgentSignedIn;

  const allMedia  = (gallery.media || []).filter((m) => !m.hidden);
  const images    = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos    = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const balance   = booking?.remainingBalance ?? 0;
  const address   = booking?.fullAddress || booking?.address || "Property";
  const coverImg  = images[0]?.url || null;
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [dlStatus, setDlStatus] = useState(null); // null | "preparing" | "ready" | "failed"

  // Large / video-heavy galleries use the prepared-download buffer: the photo +
  // floor-plan + doc bundle is built server-side, stored in R2, and served via a
  // signed URL — so the download never streams back through (or times out on)
  // our server. Small galleries stream immediately. Videos always download
  // DIRECTLY from R2 (free egress), regardless of path.
  const isHeavy = videos.length > 0 || images.length > 250;

  function triggerDownload(url, name) {
    const a = document.createElement("a");
    a.href = url; if (name) a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Download EVERY video directly from R2 (free egress). Browsers throttle/block
  // repeated programmatic <a> clicks, so we use a hidden iframe per file — each
  // R2 URL is sent with an attachment disposition, so the iframe downloads
  // instead of navigating. A stagger keeps the browser from dropping any.
  async function downloadVideosDirect() {
    if (videos.length === 0) return;
    const res = await fetch(`/api/gallery/download-urls?token=${token}&type=videos`);
    if (!res.ok) return;
    const { files } = await res.json();
    for (let i = 0; i < (files || []).length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500));
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = files[i].url;
      document.body.appendChild(iframe);
      // Leave it long enough for the download to start, then clean up.
      setTimeout(() => iframe.remove(), 60000);
    }
  }

  async function downloadEverything() {
    setDownloadingAll(true);
    try {
      if (!isHeavy) {
        // Small gallery — stream the photo/docs ZIP straight away.
        triggerDownload(`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web&extras=true`, "");
        await downloadVideosDirect();
        return;
      }

      // Heavy gallery — prepare in the background, then serve from R2.
      setDlStatus("preparing");
      const start = await fetch(`/api/gallery/prepare-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, format: "package" }), // both Print + Web-MLS
      });
      let job = await start.json().catch(() => ({}));

      // Poll until ready/failed (the POST usually finishes inline, but poll for
      // resilience if it returned early as "preparing"/"pending").
      let tries = 0;
      while (job.status && ["preparing", "pending"].includes(job.status) && tries < 60) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await fetch(`/api/gallery/prepare-download?jobId=${job.jobId}`);
        job = await poll.json().catch(() => job);
        tries++;
      }

      if (job.status === "ready" && job.downloadUrl) {
        setDlStatus("ready");
        triggerDownload(job.downloadUrl, "");
        await downloadVideosDirect();
      } else {
        // The prepared buffer didn't finish — fall back to a direct streamed
        // download (both Print + Web/MLS) plus direct video downloads, instead
        // of dead-ending. No links to copy; the files just download.
        setDlStatus("fallback");
        triggerDownload(`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web&extras=true`, "");
        await downloadVideosDirect();
      }
    } catch {
      // Even on error, get the videos downloading directly and stream the photos.
      setDlStatus("fallback");
      try { triggerDownload(`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web&extras=true`, ""); } catch {}
      try { await downloadVideosDirect(); } catch {}
    } finally {
      setDownloadingAll(false);
    }
  }

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

  function handlePaySuccess(paymentIntentId) {
    setUnlocked(true);
    setClientSecret(null);
    setPayMsg("Payment successful! Downloads unlocked.");
    // Immediately confirm server-side so booking is marked paid without
    // waiting for the Stripe webhook (belt-and-suspenders).
    if (paymentIntentId && gallery.bookingId) {
      fetch("/api/bookings/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: gallery.bookingId, paymentIntentId }),
      }).catch(() => {});
    }
    setTimeout(() => window.location.reload(), 3000);
  }

  const matterportUrl  = !gallery.matterportHidden ? (gallery.matterportUrl || null) : null;
  const cubeCasaUrl    = gallery.cubeCasaUrl || null;
  const videoUrl       = !gallery.videoUrlHidden   ? (gallery.videoUrl      || null) : null;
  const virtualLinks   = (gallery.virtualLinks  || []).filter((l) => !l.hidden);
  const floorPlans     = (gallery.floorPlans    || []).filter((fp) => !fp.hidden);
  const attachedFiles  = (gallery.attachedFiles || []).filter((f) => !f.hidden);
  const has3D          = !!(matterportUrl || cubeCasaUrl || virtualLinks.length > 0);
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
      <div className="relative h-72 md:h-[28rem] bg-gray-900 overflow-hidden">
        {coverImg && (
          <img src={coverImg} alt={address}
            className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute top-4 left-5 right-5 flex items-center justify-between">
          <span className="font-display text-white text-base tracking-widest drop-shadow opacity-90">
            {name?.toUpperCase()}
          </span>
          <div className="flex items-center gap-2">
            {agentCheckDone && isAgentSignedIn ? (
              <a href={`/${slug}/agent`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                My Portal
              </a>
            ) : (
              <a href={`/${slug}/agent/login?returnTo=/${slug}/gallery/${token}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Agent Sign In
              </a>
            )}
            {gallery.agentCanShare !== false && (
              <CopyLinkButton url={`${getAppUrl()}/${slug}/gallery/${token}`} />
            )}
          </div>
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

        {/* ── Agent portal signup callout (top) ───────────────────────── */}
        {showSignupCallout && (
          <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between ${
            requireAgentPortal
              ? "bg-blue-50 border-blue-200"
              : "bg-white border-gray-200"
          }`}>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">
                {requireAgentPortal ? "Sign up to download your media" : "Access your agent portal"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {requireAgentPortal
                  ? "Create a free account to download your full-resolution photos, floor plans, and marketing files."
                  : "Save this gallery, access marketing tools, captions, and QR codes anytime — free."}
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <a href={`/${slug}/agent/login?returnTo=/${slug}/gallery/${token}`}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">
                Sign in
              </a>
              <a href={`/${slug}/agent/register?returnTo=/${slug}/gallery/${token}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90"
                style={{ background: primary }}>
                {requireAgentPortal ? "Create Account to Download →" : "Create Free Account →"}
              </a>
            </div>
          </div>
        )}

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

        {/* ── Brochure — marketing materials require the balance to be fully paid,
              not just an unlocked/delivered gallery. ── */}
        {unlocked && balance <= 0 && booking?.propertyWebsite?.published && (
          <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: primary + "18" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={primary} strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">Property Brochure</p>
                <p className="text-xs text-gray-400">Download or share the listing brochure</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <a href={`/${slug}/property/${booking.id || gallery.bookingId}/brochure`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Download Brochure
              </a>
              {gallery.showPropertyWebsiteLink !== false && (
                <a href={`/${slug}/property/${booking.id || gallery.bookingId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: primary }}>
                  View Listing ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* Marketing locked until paid */}
        {unlocked && balance > 0 && booking?.propertyWebsite?.published && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-amber-500 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Marketing materials unlock after payment</p>
              <p className="text-xs text-amber-700">Pay the remaining balance above to download the brochure and listing materials.</p>
            </div>
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
              {canDownload && (
                <p className="text-xs text-gray-400 mt-2 max-w-md leading-relaxed">
                  Download all available media from this gallery, including photos, floor plans,
                  documents, videos, and important listing links. Large videos may download
                  separately to keep delivery fast and reliable.
                </p>
              )}
            </div>
            {canDownload ? (
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <button
                  onClick={downloadEverything}
                  disabled={downloadingAll}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: primary }}>
                  {downloadingAll
                    ? (dlStatus === "preparing" ? "Preparing your download…" : "Starting downloads…")
                    : "↓ Download Everything"}
                </button>
                {dlStatus === "preparing" && (
                  <span className="text-xs text-gray-500 max-w-[16rem] text-right">
                    Preparing your download. Large video-heavy galleries may take a few minutes.
                  </span>
                )}
                {dlStatus === "ready" && (
                  <span className="text-xs text-green-600">Your download is ready.</span>
                )}
                {dlStatus === "fallback" && (
                  <span className="text-xs text-gray-500 max-w-[16rem] text-right">
                    Starting your downloads now. Your browser may ask permission to download multiple files.
                  </span>
                )}
              </div>
            ) : requireAgentPortal ? (
              <a href={`/${slug}/agent/register?returnTo=/${slug}/gallery/${token}`}
                className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90"
                style={{ background: primary }}>
                Sign up to Download →
              </a>
            ) : null}
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
                canDownload ? (
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
                ) : requireAgentPortal ? (
                  <a href={`/${slug}/agent/register?returnTo=/${slug}/gallery/${token}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ background: primary }}>
                    Sign up to Download →
                  </a>
                ) : null
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
                      {canDownload ? (
                        <div className="flex gap-1.5">
                          <a href={downloadUrl(m.key, "print", m.fileName)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#3486cf]"
                            download onClick={(e) => e.stopPropagation()}>Print</a>
                          <a href={downloadUrl(m.key, "web", m.fileName)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#c4974a]"
                            download onClick={(e) => e.stopPropagation()}>Web</a>
                        </div>
                      ) : requireAgentPortal ? (
                        <a href={`/${slug}/agent/register?returnTo=/${slug}/gallery/${token}`}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide text-white bg-[#3486cf]"
                          onClick={(e) => e.stopPropagation()}>
                          Sign Up to Download
                        </a>
                      ) : null}
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
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Video Tour</h2>
              {!unlocked && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Download available after payment
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {videoUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/9" }}>
                    <iframe src={toEmbedUrl(videoUrl)} title="Video Tour"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen className="w-full h-full" style={{ minHeight: 280 }} />
                  </div>
                  {unlocked && <InlineCopyRow url={videoUrl} primary={primary} />}
                </div>
              )}
              {videos.length > 0 && (
                <div className={`grid gap-3 ${videos.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {videos.map((v, i) => (
                    <div key={i} className="rounded-xl overflow-hidden bg-gray-900 aspect-video relative group">
                      {/* Prefer the lighter 1080p web version for playback; it
                          also keeps old galleries playable after the full-res
                          original is removed for storage management. */}
                      <video src={v.webVideoUrl || v.url} className="w-full h-full" controls />
                      {/* Very subtle watermark over gallery playback (doesn't block controls;
                          not baked into the downloadable file). */}
                      {name && (
                        <div className="absolute top-2 left-3 pointer-events-none select-none text-white/25 text-[11px] font-semibold tracking-wide"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}>
                          {name}
                        </div>
                      )}
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
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">3D Tour</h2>
              {!unlocked && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Link available after payment
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {matterportUrl && (
                <div>
                  <div className="rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/9" }}>
                    <iframe src={matterportUrl} title="3D Interactive Tour"
                      allow="xr-spatial-tracking" allowFullScreen
                      className="w-full h-full" style={{ minHeight: 360 }} />
                  </div>
                  {unlocked && <InlineCopyRow url={matterportUrl} primary={primary} label="Copy Tour Link" />}
                </div>
              )}
              {cubeCasaUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor Plan · Cubo Casa</span>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-gray-900" style={{ aspectRatio: "16/9" }}>
                    <iframe src={cubeCasaUrl} title="Cubo Casa Floor Plan"
                      allow="xr-spatial-tracking" allowFullScreen
                      className="w-full h-full" style={{ minHeight: 360 }} />
                  </div>
                  {unlocked && <InlineCopyRow url={cubeCasaUrl} primary={primary} label="Copy Floor Plan Link" />}
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
                  {unlocked ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <CopyUrlButton url={l.url} />
                      <a href={l.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                        style={{ color: primary }}>
                        Open ↗
                      </a>
                    </div>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg flex-shrink-0">
                      Pay to access
                    </span>
                  )}
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
              {!unlocked && (
                <span className="ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Download available after payment
                </span>
              )}
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
                          {unlocked && viewUrl && (
                            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors">
                              View
                            </a>
                          )}
                          {unlocked && dlUrl && (
                            <a href={dlUrl} download={fp.fileName}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                              style={{ background: primary }}>
                              ↓ Download
                            </a>
                          )}
                          {!unlocked && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">
                              Pay to access
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {viewUrl && (
                          <div className="relative w-full bg-white overflow-hidden">
                            <img
                              src={viewUrl}
                              alt={fp.fileName}
                              draggable={false}
                              onContextMenu={(e) => { if (!unlocked) e.preventDefault(); }}
                              className="w-full object-contain max-h-80 select-none"
                              style={!unlocked ? { pointerEvents: "none" } : {}}
                            />
                            {!unlocked && (
                              <>
                                <div
                                  className="absolute inset-0 pointer-events-none select-none"
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="90"><text transform="rotate(-30 100 45)" x="10" y="52" font-family="Arial,sans-serif" font-size="15" font-weight="900" fill="rgba(0,0,0,0.35)" letter-spacing="4">PREVIEW ONLY</text></svg>')}")`,
                                    backgroundRepeat: "repeat",
                                    userSelect: "none",
                                    WebkitUserSelect: "none",
                                  }}
                                />
                                <div
                                  className="absolute inset-0 z-10"
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                  style={{ cursor: "default" }}
                                />
                                <div className="absolute top-2 right-2 z-20 text-[10px] font-bold uppercase tracking-wider text-white bg-amber-500 px-2 py-1 rounded-lg shadow">
                                  Pay to download
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100 bg-white gap-2">
                          <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{fp.fileName}</span>
                          {unlocked && fp.key && (
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
              {!unlocked && (
                <span className="ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Download available after payment
                </span>
              )}
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
                      {unlocked && (isPdf || isImage) && viewUrl && (
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                          View
                        </a>
                      )}
                      {unlocked && dlUrl && (
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

        {/* ── Agent portal signup callout (bottom) ────────────────────── */}
        {showSignupCallout && (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5 text-center">
            <p className="font-semibold text-gray-900 mb-1">
              {requireAgentPortal ? "Ready to download?" : "Keep this gallery at your fingertips"}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {requireAgentPortal
                ? "Create your free agent account to download full-resolution files for this listing."
                : "Sign up for a free agent portal to revisit this gallery, get social captions, a QR code, and more."}
            </p>
            <a href={`/${slug}/agent/register?returnTo=/${slug}/gallery/${token}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: primary }}>
              {requireAgentPortal ? "Create Account →" : "Sign Up Free →"}
            </a>
            <p className="text-xs text-gray-400 mt-3">
              Already have an account?{" "}
              <a href={`/${slug}/agent/login?returnTo=/${slug}/gallery/${token}`} className="hover:underline" style={{ color: primary }}>Sign in</a>
            </p>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center space-y-2">
        <p className="text-xs text-gray-400">
          Delivered by <span className="font-semibold" style={{ color: primary }}>{name}</span>
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] text-gray-300">
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">Terms of Service</a>
          <span>·</span>
          <a href="/legal/sms-consent" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">SMS Consent</a>
        </div>
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
