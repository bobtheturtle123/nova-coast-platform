"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useBookingStore } from "@/store/bookingStore";
import { getAppUrl } from "@/lib/appUrl";

const MarketingStudio = dynamic(() => import("@/components/marketing/MarketingStudio"), { ssr: false });

const REVISION_STATUS = {
  pending:      { label: "Pending",      cls: "bg-amber-100 text-amber-700" },
  acknowledged: { label: "Acknowledged", cls: "bg-blue-100 text-blue-700" },
  resolved:     { label: "Resolved",     cls: "bg-emerald-100 text-emerald-700" },
  cancelled:    { label: "Cancelled",    cls: "bg-gray-100 text-gray-500" },
};

export default function AgentBookingClient({ booking, gallery, branding, slug, token, allowRevisions, revisions: initialRevisions }) {
  const router         = useRouter();
  const preloadReorder = useBookingStore((s) => s.preloadReorder);
  const [tab,      setTab]      = useState("overview");
  const [copied,   setCopied]   = useState(null);
  const [revisions,    setRevisions]    = useState(initialRevisions || []);
  const [revMsg,       setRevMsg]       = useState("");
  const [revSending,   setRevSending]   = useState(false);
  const [revText,      setRevText]      = useState("");

  const pw             = booking.propertyWebsite || {};
  const listingUrl     = `${getAppUrl()}/${slug}/property/${booking.id}`;
  const unbrandedUrl   = `${listingUrl}?unbranded=1`;
  const brochureUrl    = `/${slug}/property/${booking.id}/brochure`;
  const galleryUrl  = gallery?.accessToken ? `/${slug}/gallery/${gallery.accessToken}` : null;
  const qrUrl       = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=200x200&color=${branding.primary.replace("#", "")}&bgcolor=FFFFFF`;

  async function submitRevision() {
    if (!revText.trim()) return;
    setRevSending(true);
    try {
      const res = await fetch(`/api/${slug}/agent/revision-request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, bookingId: booking.id, message: revText }),
      });
      const data = await res.json();
      if (data.ok) {
        setRevisions((prev) => [{
          id: data.revisionId, status: "pending", message: revText,
          requestedAt: new Date().toISOString(), adminNotes: "", resolvedAt: null,
        }, ...prev]);
        setRevText("");
        setRevMsg("Revision request submitted. You'll be notified when it's addressed.");
      } else {
        setRevMsg(data.error || "Failed to submit.");
      }
    } catch { setRevMsg("Something went wrong."); }
    setRevSending(false);
    setTimeout(() => setRevMsg(""), 5000);
  }

  function handleReorder() {
    preloadReorder({
      packageId:     booking.packageId     || null,
      serviceIds:    booking.serviceIds    || [],
      addonIds:      booking.addonIds      || [],
      address:       booking.addressLine   || booking.address || "",
      city:          booking.city          || "",
      state:         booking.state         || "",
      zip:           booking.zip           || "",
      lat:           booking.lat           || null,
      lng:           booking.lng           || null,
      squareFootage: booking.squareFootage || "",
      propertyType:  booking.propertyType  || "residential",
      clientName:    booking.clientName    || "",
      clientEmail:   booking.clientEmail   || "",
      clientPhone:   booking.clientPhone   || "",
    });
    router.push(`/${slug}/book`);
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const pendingRevisions = revisions.filter((r) => r.status === "pending").length;
  const TABS = [
    { id: "overview",  label: "Overview" },
    { id: "marketing", label: "Marketing" },
    ...(galleryUrl ? [{ id: "gallery", label: `Gallery${gallery?.imageCount > 0 ? ` (${gallery.imageCount})` : ""}` }] : []),
    ...(pw?.published && gallery?.showPropertyWebsiteLink !== false ? [{ id: "website", label: "Property Website" }] : []),
    ...(booking.totalPrice > 0 ? [{ id: "invoice", label: "Invoice" }] : []),
    ...(allowRevisions ? [{ id: "revisions", label: pendingRevisions > 0 ? `Revisions (${pendingRevisions})` : "Revisions" }] : []),
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
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Media Delivered</p>
                <p className="text-sm text-emerald-600">Your photos and videos are ready.</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
              </div>
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
                <div className="w-10 h-10 rounded-xl bg-[#3486cf]/8 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">View Gallery</p>
                <p className="text-xs text-gray-400">{gallery.imageCount} photos{gallery.videoCount > 0 ? ` · ${gallery.videoCount} videos` : ""}</p>
              </a>
            )}

            {pw?.published && gallery?.showPropertyWebsiteLink !== false && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <div className="w-10 h-10 rounded-xl bg-[#3486cf]/8 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Property Website</p>
                <p className="text-xs text-gray-400">Share with buyers</p>
              </a>
            )}

            {pw?.published && gallery?.showPropertyWebsiteLink !== false && (
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <div className="w-10 h-10 rounded-xl bg-[#3486cf]/8 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Print Brochure</p>
                <p className="text-xs text-gray-400">PDF / print ready</p>
              </a>
            )}

            {gallery?.matterportUrl && (
              <a href={gallery.matterportUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <div className="w-10 h-10 rounded-xl bg-[#3486cf]/8 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">3D Tour</p>
                <p className="text-xs text-gray-400">Matterport walkthrough</p>
              </a>
            )}

            {gallery?.videoUrl && (
              <a href={gallery.videoUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <div className="w-10 h-10 rounded-xl bg-[#3486cf]/8 flex items-center justify-center">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Video Tour</p>
                <p className="text-xs text-gray-400">Watch the walkthrough</p>
              </a>
            )}
          </div>

          {/* Quick Reorder */}
          <div className="bg-[#EEF5FC] border border-[#3486cf]/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1E5A8A]">Reorder services or use as template</p>
              <p className="text-xs text-[#3486cf]/70 mt-0.5">Pre-fills your address, package, and services from this order.</p>
            </div>
            <button onClick={handleReorder}
              className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors"
              style={{ background: branding.primary }}>
              Quick Reorder →
            </button>
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
          {/* Listing URL — branded + unbranded */}
          {pw?.published && gallery?.showPropertyWebsiteLink !== false && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Property Website</p>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Branded (with photographer info)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-[#3486cf] flex-1 truncate bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                      {listingUrl}
                    </code>
                    <button onClick={() => copy(listingUrl, "url")}
                      className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                      {copied === "url" ? "✓ Copied" : "Copy"}
                    </button>
                    <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-2 rounded-lg text-white flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{ background: branding.primary }}>
                      Open ↗
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Unbranded (agent use / MLS)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-gray-500 flex-1 truncate bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                      {unbrandedUrl}
                    </code>
                    <button onClick={() => copy(unbrandedUrl, "unbranded")}
                      className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                      {copied === "unbranded" ? "✓ Copied" : "Copy"}
                    </button>
                    <a href={unbrandedUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0 transition-colors">
                      Open ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code */}
          {pw?.published && gallery?.showPropertyWebsiteLink !== false && (
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
          {pw?.published && gallery?.showPropertyWebsiteLink !== false && (
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

          {/* Marketing Studio — social graphics */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Social Media Graphics</p>
            <MarketingStudio
              booking={booking}
              branding={branding}
              coverUrl={gallery?.coverUrl || (gallery?.media?.find((m) => !m.hidden && m.key)
                ? `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${gallery.media.find((m) => !m.hidden && m.key).key}`
                : null)}
              paid={!!(booking.depositPaid || booking.paidInFull || booking.balancePaid)}
            />
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

          {(gallery.matterportUrl || gallery.videoUrl) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Additional Links</p>
              {gallery.matterportUrl && (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">3D Tour</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{gallery.matterportUrl}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => copy(gallery.matterportUrl, "matterport")}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      {copied === "matterport" ? "✓ Copied" : "Copy"}
                    </button>
                    <a href={gallery.matterportUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg text-white transition-colors"
                      style={{ background: branding.primary }}>
                      Open →
                    </a>
                  </div>
                </div>
              )}
              {gallery.videoUrl && (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Video Tour</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{gallery.videoUrl}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => copy(gallery.videoUrl, "video")}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      {copied === "video" ? "✓ Copied" : "Copy"}
                    </button>
                    <a href={gallery.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg text-white transition-colors"
                      style={{ background: branding.primary }}>
                      Open →
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INVOICE TAB ────────────────────────────────────────────── */}
      {tab === "invoice" && (
        <div className="space-y-4">
          {/* Services */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Services</p>
            <div className="space-y-2.5">
              {booking.packageId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Package — {booking.packageId}</span>
                  <span className="font-medium text-gray-900">${Number(booking.totalPrice).toLocaleString()}</span>
                </div>
              )}
              {(booking.serviceIds || []).map((s) => (
                <div key={s} className="flex justify-between text-sm">
                  <span className="text-gray-600">{s}</span>
                  <span className="text-gray-400">—</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100 flex justify-between font-semibold text-sm">
                <span className="text-gray-800">Total</span>
                <span className="text-gray-900">${Number(booking.totalPrice).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Payment Status</p>
            <div className="space-y-3">
              {/* Deposit row */}
              {booking.depositAmount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${booking.depositPaid ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className="text-sm text-gray-600">Deposit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">${Number(booking.depositAmount).toFixed(2)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${booking.depositPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {booking.depositPaid ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              )}

              {/* Balance row */}
              {booking.totalPrice > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${booking.balancePaid ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className="text-sm text-gray-600">Remaining balance</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      ${Number(booking.depositAmount > 0 ? (booking.totalPrice - booking.depositAmount) : booking.totalPrice).toFixed(2)}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${booking.balancePaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {booking.balancePaid ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              )}

              {/* Total paid / outstanding summary */}
              <div className="pt-3 mt-1 border-t border-gray-100 space-y-2">
                {(() => {
                  const total    = Number(booking.totalPrice) || 0;
                  const deposit  = Number(booking.depositAmount) || 0;
                  const paid     = (booking.depositPaid ? deposit : 0) + (booking.balancePaid ? (total - deposit) : 0);
                  const outstanding = Math.max(0, total - paid);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total paid</span>
                        <span className="font-semibold text-emerald-700">${paid.toFixed(2)}</span>
                      </div>
                      {outstanding > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-amber-700 font-medium">Outstanding balance</span>
                          <span className="font-bold text-amber-700">${outstanding.toFixed(2)}</span>
                        </div>
                      )}
                      {outstanding === 0 && total > 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Paid in full
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">For payment questions, contact your photographer directly.</p>
        </div>
      )}

      {/* ── PROPERTY WEBSITE TAB ───────────────────────────────────── */}
      {tab === "website" && pw?.published && gallery?.showPropertyWebsiteLink !== false && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Your Property Website</p>
            <div className="flex items-center gap-2 mb-4">
              <code className="text-sm text-[#3486cf] flex-1 truncate bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                {listingUrl}
              </code>
              <button onClick={() => copy(listingUrl, "url")}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                {copied === "url" ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
            <div className="flex gap-3 flex-wrap">
              <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium px-4 py-2 rounded-lg text-white inline-block transition-colors"
                style={{ background: branding.primary }}>
                View Live Site →
              </a>
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 inline-block transition-colors text-gray-700">
                Print Brochure →
              </a>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">QR Code</p>
            <div className="flex items-center gap-5">
              <img src={qrUrl} alt="QR Code" className="w-24 h-24 rounded-lg border border-gray-100" />
              <div>
                <p className="text-sm text-gray-600 mb-2">Share this QR code at open houses or in print materials.</p>
                <a href={qrUrl} download="property-qr.png"
                  className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors inline-block">
                  ↓ Download QR
                </a>
              </div>
            </div>
          </div>

          {(pw.beds || pw.baths || pw.sqft || pw.price) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Property Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pw.price && <div><p className="text-xs text-gray-400">Price</p><p className="font-semibold text-gray-800">{pw.price}</p></div>}
                {pw.beds  && <div><p className="text-xs text-gray-400">Beds</p><p className="font-semibold text-gray-800">{pw.beds}</p></div>}
                {pw.baths && <div><p className="text-xs text-gray-400">Baths</p><p className="font-semibold text-gray-800">{pw.baths}</p></div>}
                {pw.sqft  && <div><p className="text-xs text-gray-400">Sq Ft</p><p className="font-semibold text-gray-800">{Number(pw.sqft).toLocaleString()}</p></div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVISIONS TAB ────────────────────────────────────────────── */}
      {tab === "revisions" && allowRevisions && (
        <div className="space-y-5">
          <>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Submit a Revision Request</p>
            <textarea
              rows={4}
              value={revText}
              onChange={(e) => setRevText(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 resize-none mb-3"
              placeholder="Describe what needs to be changed or re-shot…"
            />
            {revMsg && (
              <p className={`text-sm mb-3 ${revMsg.includes("submitted") ? "text-emerald-600" : "text-red-500"}`}>
                {revMsg}
              </p>
            )}
            <button onClick={submitRevision} disabled={revSending || !revText.trim()}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg text-white transition-colors disabled:opacity-50"
              style={{ background: branding.primary }}>
              {revSending ? "Submitting…" : "Submit Request"}
            </button>
          </div>

          {revisions.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Previous Requests</p>
              <div className="space-y-3">
                {revisions.map((r) => {
                  const st = REVISION_STATUS[r.status] || { label: r.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          {r.requestedAt && (
                            <span className="text-xs text-gray-400">
                              {new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        {r.status === "pending" && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/${slug}/agent/revision/${r.id}`, {
                                method:  "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body:    JSON.stringify({ token, status: "cancelled" }),
                              });
                              if (res.ok) {
                                setRevisions((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "cancelled" } : x));
                              }
                            }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                            Cancel request
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{r.message}</p>
                      {r.adminNotes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-400 mb-0.5">Response</p>
                          <p className="text-sm text-gray-600">{r.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {revisions.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <p className="text-sm">No revision requests yet.</p>
            </div>
          )}
          </>
        </div>
      )}
    </div>
  );
}
