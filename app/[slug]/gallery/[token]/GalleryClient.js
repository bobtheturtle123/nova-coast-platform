"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
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
      <div className="p-4 border border-gray-200 rounded-sm">
        <PaymentElement />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || loading}
        className="w-full py-3 rounded-sm font-semibold text-sm"
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

export default function GalleryClient({ gallery, booking, tenant, slug, token }) {
  const [unlocked,     setUnlocked]     = useState(gallery.unlocked);
  const [clientSecret, setClientSecret] = useState(null);
  const [loadingPay,   setLoadingPay]   = useState(false);
  const [payMsg,       setPayMsg]       = useState("");
  const [activeTab,    setActiveTab]    = useState("images");

  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName;

  const allMedia  = gallery.media || [];
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

  const matterportUrl  = gallery.matterportUrl || null;
  const virtualLinks   = gallery.virtualLinks  || [];
  const floorPlans     = gallery.floorPlans    || [];
  const attachedFiles  = gallery.attachedFiles || [];
  const has3D          = matterportUrl || virtualLinks.length > 0;
  const hasExtras      = has3D || floorPlans.length > 0 || attachedFiles.length > 0;

  const tabs = [
    { id: "images", label: `Photos (${images.length})` },
    ...(videos.length   > 0 ? [{ id: "videos",     label: `Videos (${videos.length})`       }] : []),
    ...(floorPlans.length > 0 ? [{ id: "floorplans", label: `Floor Plans (${floorPlans.length})` }] : []),
    ...(has3D            ? [{ id: "3d",          label: "3D Tour"                         }] : []),
    ...(attachedFiles.length > 0 ? [{ id: "files", label: `Files (${attachedFiles.length})` }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="relative h-56 md:h-72 bg-gray-900 overflow-hidden">
        {coverImg && (
          <img src={coverImg} alt={address}
            className="absolute inset-0 w-full h-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Brand */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="font-display text-white text-lg tracking-wide drop-shadow">
            {name?.toUpperCase()}
          </span>
          {unlocked && images.length > 0 && (
            <a
              href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web`}
              className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider text-white border border-white/60 hover:bg-white/10 transition-colors"
              download
            >
              ↓ Download All
            </a>
          )}
        </div>
        {/* Address */}
        <div className="absolute bottom-4 left-4">
          <h1 className="font-display text-white text-2xl md:text-3xl drop-shadow">{address}</h1>
          <p className="text-white/70 text-sm mt-0.5">{images.length} photos{videos.length > 0 ? ` · ${videos.length} videos` : ""}</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Preview-only notice */}
        {!unlocked && balance <= 0 && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-sm text-sm text-amber-800 flex items-center gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>You're viewing a <strong>preview</strong> of this gallery. Downloads are not available in preview mode.</span>
          </div>
        )}

        {/* Balance gate */}
        {!unlocked && balance > 0 && (
          <div className="bg-white rounded-sm border border-gray-200 p-6 mb-8 max-w-lg">
            <h2 className="font-display text-xl text-gray-900 mb-2">Unlock full downloads</h2>
            <p className="text-gray-500 text-sm mb-4">
              Pay your remaining balance of <strong>${balance}</strong> to download full-resolution files.
            </p>
            {payMsg && <p className="text-sm mb-4 text-blue-600">{payMsg}</p>}
            {!clientSecret && (
              <button onClick={startBalancePayment} disabled={loadingPay}
                className="py-2 px-6 rounded-sm font-semibold text-sm text-white"
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
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-sm mb-6">
            {payMsg}
          </div>
        )}

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? "border-navy text-navy"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Images tab */}
        {activeTab === "images" && (
          <>
            {images.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📷</p>
                <p>Your gallery is being prepared. Check back soon.</p>
              </div>
            ) : (
              <>
                {/* Download all buttons */}
                {unlocked && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5 p-4 bg-white rounded-sm border border-gray-200">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">Download All Photos</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="mr-3">● Print — full resolution originals</span>
                        <span>● Web / MLS — 2048px, optimized for MLS upload</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a
                        href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=print`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white"
                        style={{ background: "#0b2a55" }}
                        download
                      >
                        ↓ Print Quality
                      </a>
                      <a
                        href={`/api/gallery/download-zip?token=${token}&slug=${slug}&format=web`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-white"
                        style={{ background: "#c4974a" }}
                        download
                      >
                        ↓ Web / MLS
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {images.map((m, i) => (
                    <div key={i} className="group relative rounded-sm overflow-hidden bg-gray-200 aspect-[4/3]">
                      <img
                        src={m.url}
                        alt={m.fileName || `Photo ${i + 1}`}
                        draggable={false}
                        onContextMenu={(e) => { if (!unlocked) e.preventDefault(); }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 select-none"
                        style={!unlocked ? { pointerEvents: "none" } : {}}
                      />

                      {/* Watermark overlay — visible when not paid */}
                      {!unlocked && (
                        <div
                          className="absolute inset-0 pointer-events-none select-none overflow-hidden"
                          style={{ userSelect: "none", WebkitUserSelect: "none" }}
                        >
                          {/* Repeating diagonal watermark text */}
                          {Array.from({ length: 5 }).map((_, row) =>
                            Array.from({ length: 3 }).map((_, col) => (
                              <span
                                key={`${row}-${col}`}
                                className="absolute text-white/40 font-bold uppercase tracking-widest pointer-events-none select-none"
                                style={{
                                  fontSize: "10px",
                                  top: `${row * 22 + 8}%`,
                                  left: `${col * 38 - 8}%`,
                                  transform: "rotate(-30deg)",
                                  whiteSpace: "nowrap",
                                  letterSpacing: "0.2em",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                }}
                              >
                                PREVIEW ONLY
                              </span>
                            ))
                          )}
                          {/* Subtle dark tint */}
                          <div className="absolute inset-0 bg-black/10" />
                        </div>
                      )}

                      {unlocked && m.key && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                          <p className="text-white text-xs font-medium text-center truncate w-full px-2">
                            {m.fileName}
                          </p>
                          <div className="flex gap-2">
                            <a href={downloadUrl(m.key, "print", m.fileName)}
                              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-white"
                              style={{ background: "#0b2a55" }}
                              download>
                              Print
                            </a>
                            <a href={downloadUrl(m.key, "web", m.fileName)}
                              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-white"
                              style={{ background: "#c4974a" }}
                              download>
                              Web / MLS
                            </a>
                          </div>
                        </div>
                      )}

                      {unlocked && !m.key && (
                        <a href={m.url} download={m.fileName}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Videos tab */}
        {activeTab === "videos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((v, i) => (
              <div key={i} className="rounded-sm overflow-hidden bg-gray-900 aspect-video relative group">
                <video src={v.url} className="w-full h-full object-cover" controls />
                {unlocked && (
                  <a href={v.url} download={v.fileName}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded text-xs font-bold text-white"
                    style={{ background: "#0b2a55" }}>
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3D Tour tab */}
        {activeTab === "3d" && (
          <div className="space-y-5">
            {matterportUrl && (
              <div className="rounded-sm overflow-hidden border border-gray-200 bg-gray-900" style={{ aspectRatio: "16/9" }}>
                <iframe
                  src={matterportUrl}
                  title="3D Interactive Tour"
                  allow="xr-spatial-tracking"
                  allowFullScreen
                  className="w-full h-full"
                  style={{ minHeight: 400 }}
                />
              </div>
            )}
            {virtualLinks.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-sm hover:border-gray-300 hover:shadow-sm transition-all group">
                <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0"
                  style={{ background: primary + "15" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{ color: primary }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <span className="font-medium text-sm" style={{ color: primary }}>{l.label}</span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {/* Floor Plans tab */}
        {activeTab === "floorplans" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {floorPlans.map((fp, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-sm overflow-hidden">
                {fp.fileType?.includes("pdf") ? (
                  <a href={fp.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-5 hover:bg-gray-50 transition-colors">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-red-400 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-charcoal">{fp.fileName}</span>
                    <span className="ml-auto text-xs text-gray-400">View PDF →</span>
                  </a>
                ) : (
                  <>
                    <img src={fp.url} alt={fp.fileName} className="w-full object-contain max-h-96 bg-white" />
                    <div className="px-4 py-3 flex items-center justify-between border-t border-gray-50">
                      <span className="text-xs text-gray-500">{fp.fileName}</span>
                      <a href={fp.url} download={fp.fileName}
                        className="text-xs font-semibold" style={{ color: primary }}>
                        Download
                      </a>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Files tab */}
        {activeTab === "files" && (
          <div className="space-y-2 max-w-lg">
            {attachedFiles.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                download={f.fileName}
                className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-sm hover:border-gray-300 hover:shadow-sm transition-all group">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-charcoal flex-1">{f.fileName}</span>
                <span className="text-[10px] text-gray-300 font-mono uppercase">{f.fileType?.split("/")[1] || "file"}</span>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">
          Delivered by <span className="font-medium" style={{ color: primary }}>{name}</span>
        </p>
      </footer>
    </div>
  );
}
