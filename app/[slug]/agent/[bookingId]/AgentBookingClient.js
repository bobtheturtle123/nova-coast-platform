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

  const pw          = booking.propertyWebsite || {};
  const listingUrl  = `${getAppUrl()}/${slug}/property/${booking.id}`;
  const brochureUrl = `/${slug}/property/${booking.id}/brochure`;
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
    ...(pw?.published ? [{ id: "website", label: "Property Website" }] : []),
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

            {pw?.published && (
              <a href={brochureUrl} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center">
                <span className="text-2xl">📋</span>
                <p className="text-sm font-medium text-gray-700">Print Brochure</p>
                <p className="text-xs text-gray-400">PDF / print ready</p>
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
          {/* Listing URL */}
          {pw?.published && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Listing URL</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-[#3486cf] flex-1 truncate bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  {listingUrl}
                </code>
                <button onClick={() => copy(listingUrl, "url")}
                  className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  {copied === "url" ? "✓ Copied" : "Copy"}
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
          {pw?.published && (
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
              coverUrl={gallery?.coverUrl || null}
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
        </div>
      )}

      {/* ── INVOICE TAB ────────────────────────────────────────────── */}
      {tab === "invoice" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Invoice Summary</p>
            <div className="space-y-3">
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
              <div className="pt-3 border-t border-gray-100 flex justify-between font-semibold">
                <span className="text-gray-800">Total</span>
                <span className="text-gray-900">${Number(booking.totalPrice).toLocaleString()}</span>
              </div>
              {booking.remainingBalance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700 font-medium">Balance Due</span>
                  <span className="text-amber-700 font-medium">${Number(booking.remainingBalance).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400">For payment questions, contact your provider directly.</p>
        </div>
      )}

      {/* ── PROPERTY WEBSITE TAB ───────────────────────────────────── */}
      {tab === "website" && pw?.published && (
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
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        {r.requestedAt && (
                          <span className="text-xs text-gray-400">
                            {new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
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
              <p className="text-2xl mb-2">📝</p>
              <p className="text-sm">No revision requests yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
