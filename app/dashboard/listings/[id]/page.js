"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const STATUS_OPTIONS = [
  { value: "pending_payment", label: "Awaiting Payment" },
  { value: "requested",       label: "Pending Review" },
  { value: "confirmed",       label: "Confirmed" },
  { value: "completed",       label: "Shoot Complete" },
  { value: "cancelled",       label: "Cancelled" },
];

const STATUS_COLORS = {
  pending_payment: "bg-gray-100 text-gray-600",
  requested:       "bg-amber-50 text-amber-700",
  confirmed:       "bg-blue-50 text-blue-700",
  completed:       "bg-purple-50 text-purple-700",
  cancelled:       "bg-red-50 text-red-700",
};

export default function ListingDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const fileRef = useRef(null);

  const [booking,    setBooking]   = useState(null);
  const [gallery,    setGallery]   = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [uploading,  setUploading] = useState(false);
  const [uploadPct,  setUploadPct] = useState(0);
  const [tab,        setTab]       = useState("overview");
  const [msg,        setMsg]       = useState({ text: "", type: "" });
  const [showDeliver, setShowDeliver]   = useState(false);
  const [delivering,  setDelivering]   = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailNote,    setEmailNote]   = useState("");
  const [shootDate, setShootDate] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) return;

    const [bRes, gRes] = await Promise.all([
      fetch(`/api/dashboard/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/dashboard/listings/${id}/gallery`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (bRes.ok) {
      const { booking: b } = await bRes.json();
      setBooking(b);
      setShootDate(b.shootDate?.split?.("T")?.[0] || b.preferredDate?.split?.("T")?.[0] || "");
      setEmailSubject(`Your listing media is ready | ${b.fullAddress || b.address || ""}`);
    }
    if (gRes.ok) {
      const { gallery: g } = await gRes.json();
      setGallery(g);
    }
    setLoading(false);
  }

  async function patchBooking(fields) {
    setSaving(true);
    setMsg({ text: "", type: "" });
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setBooking((b) => ({ ...b, ...fields }));
        setMsg({ text: "Saved.", type: "success" });
      } else {
        setMsg({ text: "Failed to save.", type: "error" });
      }
    } catch { setMsg({ text: "Something went wrong.", type: "error" }); }
    finally { setSaving(false); }
  }

  async function ensureGallery() {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/bookings/${id}/gallery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      // Refresh gallery
      const gRes = await fetch(`/api/dashboard/listings/${id}/gallery`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (gRes.ok) {
        const { gallery: g } = await gRes.json();
        setGallery(g);
        setBooking((b) => ({ ...b, galleryId: data.galleryId }));
      }
      setTab("media");
    }
  }

  async function uploadFiles(files) {
    if (!gallery) { await ensureGallery(); }
    const currentGallery = gallery || await getGallery();
    if (!currentGallery) return;

    setUploading(true);
    setUploadPct(0);
    const token = await auth.currentUser.getIdToken();
    const total = files.length;
    let done = 0;

    for (const file of files) {
      try {
        const { uploadUrl, publicUrl, key } = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, fileType: file.type, galleryId: currentGallery.id }),
        }).then((r) => r.json());

        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

        await fetch(`/api/dashboard/galleries/${currentGallery.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ publicUrl, key, fileName: file.name, fileType: file.type }),
        });

        done++;
        setUploadPct(Math.round((done / total) * 100));
        setGallery((g) => ({
          ...g,
          media: [...(g?.media || []), { url: publicUrl, key, fileName: file.name, fileType: file.type }],
        }));
      } catch { setMsg({ text: `Failed: ${file.name}`, type: "error" }); }
    }

    setUploading(false);
    setMsg({ text: `${done} file${done !== 1 ? "s" : ""} uploaded.`, type: "success" });
    if (!booking?.galleryId) setBooking((b) => ({ ...b, galleryId: currentGallery.id }));
  }

  async function getGallery() {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/listings/${id}/gallery`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { gallery: g } = await res.json();
      setGallery(g);
      return g;
    }
    return null;
  }

  async function deliverGallery() {
    if (!gallery) return;
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${gallery.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject: emailSubject, note: emailNote }),
    });
    setDelivering(false);
    setShowDeliver(false);
    if (res.ok) {
      setGallery((g) => ({ ...g, delivered: true }));
      setMsg({ text: "Gallery delivered to client.", type: "success" });
    } else {
      setMsg({ text: "Failed to deliver.", type: "error" });
    }
  }

  async function toggleUnlock() {
    if (!gallery) return;
    const token = await auth.currentUser.getIdToken();
    const newVal = !gallery.unlocked;
    await fetch(`/api/dashboard/galleries/${gallery.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unlocked: newVal }),
    });
    setGallery((g) => ({ ...g, unlocked: newVal }));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );
  if (!booking) return (
    <div className="p-8 text-gray-500">
      Listing not found.
      <Link href="/dashboard/listings" className="block mt-2 text-navy text-sm hover:underline">← Back to listings</Link>
    </div>
  );

  const coverUrl = gallery?.media?.find((m) => !m.fileType?.startsWith("video/"))?.url || null;
  const images   = (gallery?.media || []).filter((m) => !m.fileType?.startsWith("video/"));
  const videos   = (gallery?.media || []).filter((m) =>  m.fileType?.startsWith("video/"));
  const address  = booking.fullAddress || booking.address || "Property";
  const shootDateDisplay = booking.shootDate || booking.preferredDate
    ? new Date(booking.shootDate || booking.preferredDate).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <div>
      {/* Hero */}
      <div className="relative h-52 bg-gray-900 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={address} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy/70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/60 text-xs mb-1">
                <Link href="/dashboard/listings" className="hover:text-white">← All Listings</Link>
              </p>
              <h1 className="font-display text-white text-2xl leading-tight">{address}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {gallery?.delivered && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-green-500 text-white">Listing Delivered</span>
                )}
                {booking.balancePaid && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-emerald-500 text-white">Paid</span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-600"}`}>
                  {STATUS_OPTIONS.find((s) => s.value === booking.status)?.label || booking.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {booking.status === "requested" && (
                <button onClick={() => patchBooking({ status: "confirmed" })} disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-sm bg-green-500 text-white hover:bg-green-600 transition-colors">
                  ✓ Confirm
                </button>
              )}
              <button
                onClick={() => { setTab("media"); if (!gallery && !booking.galleryId) ensureGallery(); }}
                className="px-4 py-2 text-sm font-semibold rounded-sm bg-white text-navy hover:bg-gray-100 transition-colors">
                Upload Media
              </button>
              {gallery && (
                <button onClick={() => setShowDeliver(true)}
                  className="px-4 py-2 text-sm font-semibold rounded-sm bg-gold text-navy hover:bg-gold/90 transition-colors">
                  Deliver →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "media",    label: `Media${gallery?.media?.length ? ` (${gallery.media.length})` : ""}` },
            { id: "orders",   label: "Orders" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-navy text-navy"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl">
        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-sm mb-4 ${
            msg.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {msg.text}
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Client / Agent */}
            <div className="bg-white rounded-sm border border-gray-200 p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Agent / Client</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold">
                  {booking.clientName?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-medium text-charcoal">{booking.clientName}</p>
                  <p className="text-sm text-gray-500">{booking.clientEmail}</p>
                  {booking.clientPhone && <p className="text-sm text-gray-500">{booking.clientPhone}</p>}
                </div>
              </div>
              {booking.squareFootage && (
                <p className="text-xs text-gray-400">{booking.squareFootage} sq ft · {booking.propertyType}</p>
              )}
              {booking.notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded-sm">
                  <p className="text-xs text-gray-500 italic">"{booking.notes}"</p>
                </div>
              )}
            </div>

            {/* Shoot management */}
            <div className="bg-white rounded-sm border border-gray-200 p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Shoot Details</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={booking.status}
                    onChange={(e) => patchBooking({ status: e.target.value })}
                    className="input-field w-full">
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    {booking.shootDate ? "Confirmed Shoot Date" : "Requested Date"}
                  </label>
                  <div className="flex gap-2">
                    <input type="date" value={shootDate}
                      onChange={(e) => setShootDate(e.target.value)}
                      className="input-field flex-1" />
                    <button onClick={() => patchBooking({ shootDate })} disabled={saving}
                      className="btn-outline px-3 py-2 text-xs whitespace-nowrap">
                      {saving ? "…" : "Save"}
                    </button>
                  </div>
                  {shootDateDisplay && (
                    <p className="text-xs text-gray-400 mt-1">{shootDateDisplay}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Services */}
            {(booking.packageId || booking.serviceIds?.length > 0) && (
              <div className="bg-white rounded-sm border border-gray-200 p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Services Booked</p>
                {booking.packageId && (
                  <p className="text-sm font-medium text-navy mb-2">
                    📦 Package: <span className="capitalize">{booking.packageId}</span>
                  </p>
                )}
                {booking.serviceIds?.map((s) => (
                  <p key={s} className="text-sm text-gray-600">• {s}</p>
                ))}
                {booking.addonIds?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {booking.addonIds.map((a) => (
                      <p key={a} className="text-sm text-gray-500">+ {a}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Gallery quick links */}
            {gallery && (
              <div className="bg-white rounded-sm border border-gray-200 p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Gallery</p>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    gallery.delivered ? "bg-green-50 text-green-700" :
                    gallery.unlocked  ? "bg-blue-50 text-blue-700"  :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {gallery.delivered ? "Delivered" : gallery.unlocked ? "Unlocked" : "Locked"}
                  </span>
                  <button onClick={toggleUnlock} className="text-xs text-navy hover:underline">
                    {gallery.unlocked ? "Lock gallery" : "Unlock gallery"}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-3">{images.length} photos · {videos.length} videos</p>
                <a
                  href={`/${booking.tenantSlug || ""}/gallery/${gallery.accessToken}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-navy hover:underline">
                  View agent gallery ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── MEDIA TAB ────────────────────────────────────────────────────── */}
        {tab === "media" && (
          <div>
            {/* Upload zone */}
            <div
              className="border-2 border-dashed border-gray-200 rounded-sm p-8 mb-6 text-center cursor-pointer hover:border-navy/40 hover:bg-gray-50 transition-colors"
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files).filter(
                  (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
                );
                if (files.length) uploadFiles(files);
              }}
            >
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
                onChange={(e) => e.target.files?.length && uploadFiles(Array.from(e.target.files))} />
              {uploading ? (
                <div className="max-w-xs mx-auto">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className="bg-navy h-2 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <p className="text-sm text-gray-500">Uploading… {uploadPct}%</p>
                </div>
              ) : (
                <>
                  <p className="text-2xl mb-2">☁️</p>
                  <p className="text-sm text-gray-500">
                    Drop files here or <span className="text-navy font-medium">click to upload</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Full-resolution originals — agents download web or print format
                  </p>
                </>
              )}
            </div>

            {/* Gallery actions */}
            {gallery && images.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{images.length} photos · {videos.length} videos</p>
                <div className="flex gap-2">
                  <button onClick={toggleUnlock} className="btn-outline text-xs px-3 py-1.5">
                    {gallery.unlocked ? "Lock gallery" : "Unlock gallery"}
                  </button>
                  <button onClick={() => setShowDeliver(true)} className="btn-primary text-xs px-4 py-1.5">
                    Deliver to Client
                  </button>
                </div>
              </div>
            )}

            {/* Photo grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
                {images.map((m, i) => (
                  <div key={i} className="aspect-square rounded-sm overflow-hidden bg-gray-100 relative group">
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs px-1 truncate">{i + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Videos */}
            {videos.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {videos.map((v, i) => (
                  <video key={i} src={v.url} controls className="w-full rounded-sm" />
                ))}
              </div>
            )}

            {!gallery && !booking.galleryId && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📷</p>
                <p className="text-sm">Upload photos to auto-create the gallery.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS TAB ───────────────────────────────────────────────────── */}
        {tab === "orders" && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-white rounded-sm border border-gray-200 p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Payment Summary</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold">${booking.totalPrice?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deposit (50%)</span>
                  <span className={booking.depositPaid ? "text-green-600 font-medium" : "text-gray-400"}>
                    ${booking.depositAmount?.toLocaleString()}
                    {booking.depositPaid ? " ✓ Paid" : " — Unpaid"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-3">
                  <span className="text-gray-500">Balance</span>
                  <span className={booking.balancePaid ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                    ${booking.remainingBalance?.toLocaleString()}
                    {booking.balancePaid ? " ✓ Paid" : " — Due at delivery"}
                  </span>
                </div>
              </div>
            </div>

            {booking.stripeDepositIntentId && (
              <div className="bg-gray-50 rounded-sm border border-gray-100 p-4 text-xs text-gray-500 space-y-1">
                <p>Deposit intent: <code className="font-mono">{booking.stripeDepositIntentId}</code></p>
                {booking.stripeBalanceIntentId && (
                  <p>Balance intent: <code className="font-mono">{booking.stripeBalanceIntentId}</code></p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-navy text-lg">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input type="text" value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Personal note (optional)
                </label>
                <textarea value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                  rows={3}
                  placeholder="Great shoot today! Let me know if you need anything adjusted."
                  className="input-field w-full resize-none" />
              </div>
              {/* Preview */}
              <div className="bg-gray-50 rounded-sm p-4 text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Preview</p>
                <p>Hi {booking.clientName?.split(" ")[0] || "there"},</p>
                {emailNote && <p className="italic text-gray-500">{emailNote}</p>}
                <p>Your media for <strong>{address}</strong> is ready to view and download.</p>
                <p className="text-navy underline text-xs">[ View Gallery → ]</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button onClick={deliverGallery} disabled={delivering} className="btn-primary px-6 py-2 text-sm">
                {delivering ? "Sending…" : "Deliver →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
