"use client";

import { useState } from "react";
import Link from "next/link";

export default function AgentBookingClient({ booking, gallery, branding, slug, token }) {
  const [captions,        setCaptions]        = useState(null);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsCopied,  setCaptionsCopied]  = useState(null);
  const [tab,             setTab]             = useState("overview");

  const pw          = booking.propertyWebsite || {};
  const listingUrl  = typeof window !== "undefined"
    ? `${window.location.origin}/${slug}/property/${booking.id}`
    : `/${slug}/property/${booking.id}`;
  const brochureUrl = `/${slug}/property/${booking.id}/brochure`;
  const galleryUrl  = gallery?.accessToken ? `/${slug}/gallery/${gallery.accessToken}` : null;
  const qrUrl       = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=200x200&color=${branding.primary.replace("#", "")}&bgcolor=FFFFFF`;

  async function generateCaptions() {
    setCaptionsLoading(true);
    try {
      const res = await fetch(`/api/${slug}/agent/captions?bookingId=${booking.id}&token=${token}`);
      const data = await res.json();
      if (data.captions) setCaptions(data.captions);
    } catch { /* silent */ }
    finally { setCaptionsLoading(false); }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCaptionsCopied(key);
    setTimeout(() => setCaptionsCopied(null), 2000);
  }

  const TABS = [
    { id: "overview",  label: "Overview" },
    { id: "marketing", label: "Marketing" },
    ...(galleryUrl ? [{ id: "gallery", label: `Gallery${gallery?.imageCount > 0 ? ` (${gallery.imageCount})` : ""}` }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href={`/${slug}/agent?token=${token}`}
        className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-flex items-center gap-1">
        ← All listings
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-gray-900 mt-2">{booking.address}</h1>
        {booking.shootDate && (
          <p className="text-sm text-gray-400 mt-1">
            Shoot: {new Date(booking.shootDate).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-gray-800 text-gray-800" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Status */}
          {gallery?.delivered ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-emerald-800">Media Delivered</p>
                <p className="text-sm text-emerald-600">Your photos and videos are ready.</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="font-semibold text-amber-800">Media In Progress</p>
                <p className="text-sm text-amber-600">Your media is being edited. You'll be notified when it's ready.</p>
              </div>
            </div>
          )}

          {/* Quick links grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {galleryUrl && (
              <a href={galleryUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <span className="text-2xl">🖼️</span>
                <p className="text-sm font-medium text-gray-700">View Gallery</p>
                <p className="text-xs text-gray-400">{gallery.imageCount} photos{gallery.videoCount > 0 ? ` · ${gallery.videoCount} videos` : ""}</p>
              </a>
            )}

            {pw?.published && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <span className="text-2xl">🏡</span>
                <p className="text-sm font-medium text-gray-700">Property Website</p>
                <p className="text-xs text-gray-400">Share with buyers</p>
              </a>
            )}

            {pw && (
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <span className="text-2xl">📋</span>
                <p className="text-sm font-medium text-gray-700">Print Brochure</p>
                <p className="text-xs text-gray-400">PDF / print ready</p>
              </a>
            )}
          </div>

          {/* Property details */}
          {pw && (pw.beds || pw.baths || pw.sqft || pw.price) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Property Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pw.price   && <div><p className="text-xs text-gray-400">Price</p><p className="font-semibold text-gray-800">{pw.price}</p></div>}
                {pw.beds    && <div><p className="text-xs text-gray-400">Beds</p><p className="font-semibold text-gray-800">{pw.beds}</p></div>}
                {pw.baths   && <div><p className="text-xs text-gray-400">Baths</p><p className="font-semibold text-gray-800">{pw.baths}</p></div>}
                {pw.sqft    && <div><p className="text-xs text-gray-400">Sq Ft</p><p className="font-semibold text-gray-800">{Number(pw.sqft).toLocaleString()}</p></div>}
              </div>
              {pw.description && (
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">{pw.description.slice(0, 300)}{pw.description.length > 300 ? "…" : ""}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MARKETING TAB ──────────────────────────────────────────── */}
      {tab === "marketing" && (
        <div className="space-y-5">
          {/* Listing URL */}
          {pw?.published && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Listing URL</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-navy flex-1 truncate bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  {listingUrl}
                </code>
                <button onClick={() => copy(listingUrl, "url")}
                  className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  {captionsCopied === "url" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* QR Code */}
          {pw?.published && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">QR Code</p>
              <div className="flex items-center gap-5">
                <img src={qrUrl} alt="QR Code" className="w-24 h-24 rounded-lg border border-gray-100" />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Download and use in print marketing.</p>
                  <a href={qrUrl} download="qr-code.png"
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors inline-block">
                    ↓ Download QR
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Brochure */}
          {pw && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Print Brochure</p>
              <p className="text-sm text-gray-500 mb-3">One-page printable PDF with photos, property details, and agent info.</p>
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium px-4 py-2 rounded-lg text-white inline-block transition-colors"
                style={{ background: branding.primary }}>
                Open Brochure →
              </a>
            </div>
          )}

          {/* AI Social Captions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Social Media Captions</p>
              <button onClick={generateCaptions} disabled={captionsLoading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ background: branding.primary }}>
                {captionsLoading ? "Generating…" : captions ? "Regenerate" : "✨ Generate"}
              </button>
            </div>

            {captions ? (
              <div className="space-y-3">
                {[
                  { key: "instagram", label: "Instagram", icon: "📸" },
                  { key: "facebook",  label: "Facebook",  icon: "📘" },
                  { key: "emailSubject", label: "Email Subject", icon: "✉️" },
                ].map(({ key, label, icon }) => captions[key] && (
                  <div key={key} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-500">{icon} {label}</span>
                      <button onClick={() => copy(captions[key], key)}
                        className="text-xs text-navy hover:opacity-70">
                        {captionsCopied === key ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{captions[key]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Generate ready-to-post Instagram, Facebook, and email subject lines with one click.</p>
            )}
          </div>
        </div>
      )}

      {/* ── GALLERY TAB ────────────────────────────────────────────── */}
      {tab === "gallery" && gallery?.accessToken && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-600 mb-4">
              {gallery.imageCount} photo{gallery.imageCount !== 1 ? "s" : ""}
              {gallery.videoCount > 0 ? ` · ${gallery.videoCount} video${gallery.videoCount !== 1 ? "s" : ""}` : ""}
              {gallery.unlocked ? " · Downloads unlocked" : " · Preview only"}
            </p>
            <a href={`/${slug}/gallery/${gallery.accessToken}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium px-4 py-2 rounded-lg text-white inline-block transition-colors"
              style={{ background: branding.primary }}>
              Open Gallery →
            </a>
          </div>

          {gallery.coverUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <img src={gallery.coverUrl} alt="Gallery preview" className="w-full h-48 object-cover" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
