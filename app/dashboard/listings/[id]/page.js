"use client";

import { useEffect, useState } from "react";
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
  completed:       "bg-emerald-50 text-emerald-700",
  cancelled:       "bg-red-50 text-red-600",
};

export default function ListingDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();

  const [booking,    setBooking]   = useState(null);
  const [gallery,    setGallery]   = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [tab,        setTab]       = useState("overview");
  const [msg,        setMsg]       = useState({ text: "", type: "" });
  const [showDeliver, setShowDeliver]   = useState(false);
  const [delivering,  setDelivering]   = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailNote,    setEmailNote]   = useState("");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("");

  // Property website state
  const [propSite,      setPropSite]      = useState({});
  const [savingPropSite, setSavingPropSite] = useState(false);
  const [propSiteMsg,   setPropSiteMsg]   = useState({ text: "", type: "" });
  const [tenantSlug,    setTenantSlug]    = useState("");

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) return;

    const [bRes, gRes, tRes] = await Promise.all([
      fetch(`/api/dashboard/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/dashboard/listings/${id}/gallery`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (tRes.ok) {
      const { tenant } = await tRes.json();
      if (tenant?.slug) setTenantSlug(tenant.slug);
    }

    if (bRes.ok) {
      const { booking: b } = await bRes.json();
      setBooking(b);
      setShootDate(b.shootDate?.split?.("T")?.[0] || b.preferredDate?.split?.("T")?.[0] || "");
      setShootTime(b.shootTime || "");
      setEmailSubject(`Your listing media is ready | ${b.fullAddress || b.address || ""}`);
      if (b.propertyWebsite) setPropSite(b.propertyWebsite);
      else setPropSite({ address: b.fullAddress || b.address || "" });
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

  async function openGalleryEditor() {
    if (gallery) {
      router.push(`/dashboard/galleries/${gallery.id}`);
      return;
    }
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/bookings/${id}/gallery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/galleries/${data.galleryId}`);
    }
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

  async function savePropSite() {
    setSavingPropSite(true);
    setPropSiteMsg({ text: "", type: "" });
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyWebsite: propSite }),
      });
      if (res.ok) {
        setBooking((b) => ({ ...b, propertyWebsite: propSite }));
        setPropSiteMsg({ text: "Property website saved.", type: "success" });
      } else {
        setPropSiteMsg({ text: "Failed to save.", type: "error" });
      }
    } catch { setPropSiteMsg({ text: "Something went wrong.", type: "error" }); }
    finally { setSavingPropSite(false); }
  }

  function setPropField(field, value) {
    setPropSite((p) => ({ ...p, [field]: value }));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
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
      <div className="relative h-52 bg-navy overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={address} className="absolute inset-0 w-full h-full object-cover opacity-45" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy-dark to-navy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/60 text-xs mb-1">
                <Link href="/dashboard/listings" className="hover:text-white">← All Listings</Link>
              </p>
              <h1 className="font-semibold text-white text-2xl leading-tight">{address}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {gallery?.delivered && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-green-500 text-white">Listing Delivered</span>
                )}
                {booking.paidInFull && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-emerald-500 text-white">Paid in Full</span>
                )}
                {!booking.paidInFull && booking.balancePaid && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-emerald-500 text-white">Fully Paid</span>
                )}
                {!booking.paidInFull && !booking.balancePaid && booking.depositPaid && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-blue-500 text-white">Deposit Paid</span>
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
                onClick={openGalleryEditor}
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
            { id: "overview",  label: "Overview" },
            { id: "orders",    label: "Orders" },
            { id: "property",  label: "Property Site" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-charcoal text-charcoal"
                  : "border-transparent text-gray-400 hover:text-gray-600"
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
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
              {(booking.sqft || booking.squareFootage) && (
                <p className="text-xs text-gray-400">{(booking.sqft || booking.squareFootage).toLocaleString()} sq ft{booking.propertyType ? ` · ${booking.propertyType}` : ""}</p>
              )}
              {booking.notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded-sm">
                  <p className="text-xs text-gray-500 italic">"{booking.notes}"</p>
                </div>
              )}
            </div>

            {/* Shoot management */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Shoot Details</p>
              <div className="space-y-4">
                {/* Auto-derived status badges */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment Status</label>
                  <div className="flex flex-wrap gap-2">
                    {booking.paidInFull || booking.balancePaid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Paid in Full
                      </span>
                    ) : booking.depositPaid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-sm bg-blue-50 text-blue-700 border border-blue-200">
                        ◑ Deposit Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-sm bg-gray-50 text-gray-500 border border-gray-200">
                        ○ Unpaid
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-sm border ${
                      gallery?.delivered
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-600 border-amber-200"
                    }`}>
                      {gallery?.delivered ? "✓ Delivered" : "— Undelivered"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Workflow Stage</label>
                  <select
                    value={booking.status}
                    onChange={(e) => patchBooking({ status: e.target.value })}
                    className="input-field w-full">
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {/* Client requested time */}
                {(booking.preferredDate || booking.preferredTime) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2.5 text-xs">
                    <p className="font-semibold text-amber-800 mb-0.5">Client Requested</p>
                    <p className="text-amber-700">
                      {booking.preferredDate
                        ? new Date(booking.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                        : "No date specified"}
                      {booking.preferredTime && ` · ${
                        booking.preferredTime === "morning"   ? "Morning (8am–12pm)" :
                        booking.preferredTime === "afternoon" ? "Afternoon (12pm–5pm)" :
                        booking.preferredTime === "flexible"  ? "Flexible / Any time" :
                        booking.preferredTimeSpecific         ? `Specific time: ${booking.preferredTimeSpecific}` :
                        booking.preferredTime
                      }`}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Confirm Shoot Date &amp; Time
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input type="date" value={shootDate}
                      onChange={(e) => setShootDate(e.target.value)}
                      className="input-field flex-1" />
                    <input type="time" value={shootTime}
                      onChange={(e) => setShootTime(e.target.value)}
                      className="input-field w-32" />
                  </div>
                  <button onClick={() => patchBooking({ shootDate, shootTime })} disabled={saving}
                    className="btn-primary w-full py-2 text-xs">
                    {saving ? "Saving…" : "Confirm Shoot Date"}
                  </button>
                  {booking.shootDate && (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Confirmed: {shootDateDisplay}{booking.shootTime ? ` at ${booking.shootTime}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Services */}
            {(booking.packageId || booking.serviceIds?.length > 0) && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
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

        {/* ── ORDERS TAB ───────────────────────────────────────────────────── */}
        {tab === "orders" && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Payment Summary</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold">${(booking.totalPrice || 0).toLocaleString()}</span>
                </div>

                {booking.paidInFull ? (
                  <div className="flex justify-between text-green-700 font-medium">
                    <span>Paid in full</span>
                    <span>${(booking.totalPrice || 0).toLocaleString()} ✓</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deposit</span>
                      <span className={booking.depositPaid ? "text-green-600 font-medium" : "text-gray-400"}>
                        ${(booking.depositAmount || 0).toLocaleString()}
                        {booking.depositPaid ? " ✓ Paid" : " — Unpaid"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-100 pt-3">
                      <span className="text-gray-500">Balance due</span>
                      <span className={booking.balancePaid ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                        ${(booking.remainingBalance || 0).toLocaleString()}
                        {booking.balancePaid ? " ✓ Paid" : " — Due at delivery"}
                      </span>
                    </div>
                  </>
                )}

                {booking.tipAmount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tip</span>
                    <span className="text-green-600 font-medium">+${booking.tipAmount.toLocaleString()}</span>
                  </div>
                )}
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

        {/* ── PROPERTY SITE TAB ────────────────────────────────────────────── */}
        {tab === "property" && (
          <div className="max-w-2xl space-y-6">
            {/* Publish status */}
            <div className="flex items-center justify-between bg-white rounded-sm border border-gray-200 p-4">
              <div>
                <p className="text-sm font-semibold text-charcoal">
                  {propSite.published ? "🟢 Website is live" : "⚫ Website is draft (not public)"}
                </p>
                {propSite.published && (
                  <a
                    href={`/${tenantSlug || ""}/property/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-navy underline underline-offset-2 hover:opacity-70"
                  >
                    View public website →
                  </a>
                )}
              </div>
              <button
                onClick={async () => {
                  const next = { ...propSite, published: !propSite.published };
                  setPropSite(next);
                  setSavingPropSite(true);
                  try {
                    const token = await auth.currentUser.getIdToken();
                    const res = await fetch(`/api/dashboard/bookings/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ propertyWebsite: next }),
                    });
                    if (res.ok) {
                      setBooking((b) => ({ ...b, propertyWebsite: next }));
                      setPropSiteMsg({ text: next.published ? "Website is now live." : "Website unpublished.", type: "success" });
                    } else {
                      setPropSiteMsg({ text: "Failed to update.", type: "error" });
                    }
                  } catch { setPropSiteMsg({ text: "Something went wrong.", type: "error" }); }
                  finally { setSavingPropSite(false); }
                }}
                disabled={savingPropSite}
                className={`px-4 py-2 text-sm font-semibold rounded-sm transition-colors disabled:opacity-60 ${
                  propSite.published
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                {savingPropSite ? "…" : propSite.published ? "Unpublish" : "Publish"}
              </button>
            </div>

            {propSiteMsg.text && (
              <div className={`text-sm px-4 py-2.5 rounded-sm ${
                propSiteMsg.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>{propSiteMsg.text}</div>
            )}

            {/* Property details */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-5">Property Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="label-field">Address / Title</label>
                  <input type="text" value={propSite.address || ""}
                    onChange={(e) => setPropField("address", e.target.value)}
                    className="input-field w-full" placeholder={booking?.fullAddress || booking?.address} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Listing Price</label>
                    <input type="text" value={propSite.price || ""}
                      onChange={(e) => setPropField("price", e.target.value)}
                      className="input-field w-full" placeholder="e.g. $450,000" />
                  </div>
                  <div>
                    <label className="label-field">Property Type</label>
                    <input type="text" value={propSite.type || ""}
                      onChange={(e) => setPropField("type", e.target.value)}
                      className="input-field w-full" placeholder="e.g. Single Family" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label-field">Beds</label>
                    <input type="text" value={propSite.beds || ""}
                      onChange={(e) => setPropField("beds", e.target.value)}
                      className="input-field w-full" placeholder="4" />
                  </div>
                  <div>
                    <label className="label-field">Baths</label>
                    <input type="text" value={propSite.baths || ""}
                      onChange={(e) => setPropField("baths", e.target.value)}
                      className="input-field w-full" placeholder="2.5" />
                  </div>
                  <div>
                    <label className="label-field">Sq Ft</label>
                    <input type="text" value={propSite.sqft || ""}
                      onChange={(e) => setPropField("sqft", e.target.value)}
                      className="input-field w-full" placeholder="2,200" />
                  </div>
                </div>
                <div>
                  <label className="label-field">Year Built</label>
                  <input type="text" value={propSite.yearBuilt || ""}
                    onChange={(e) => setPropField("yearBuilt", e.target.value)}
                    className="input-field w-48" placeholder="2005" />
                </div>
                <div>
                  <label className="label-field">Description</label>
                  <textarea
                    value={propSite.description || ""}
                    onChange={(e) => setPropField("description", e.target.value)}
                    rows={5}
                    placeholder="Describe the property — highlights, neighborhood, recent upgrades…"
                    className="input-field w-full resize-y"
                  />
                </div>
                <div>
                  <label className="label-field">Features (one per line)</label>
                  <textarea
                    value={(propSite.features || []).join("\n")}
                    onChange={(e) => setPropField("features", e.target.value.split("\n").filter((f) => f.trim()))}
                    rows={4}
                    placeholder={"Hardwood floors\nGranite countertops\nAttached 2-car garage"}
                    className="input-field w-full resize-y text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Agent info */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-5">Listing Agent</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Agent Name</label>
                    <input type="text" value={propSite.agentName || ""}
                      onChange={(e) => setPropField("agentName", e.target.value)}
                      className="input-field w-full" placeholder={booking?.clientName} />
                  </div>
                  <div>
                    <label className="label-field">Brokerage</label>
                    <input type="text" value={propSite.agentBrokerage || ""}
                      onChange={(e) => setPropField("agentBrokerage", e.target.value)}
                      className="input-field w-full" placeholder="RE/MAX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Phone</label>
                    <input type="tel" value={propSite.agentPhone || ""}
                      onChange={(e) => setPropField("agentPhone", e.target.value)}
                      className="input-field w-full" placeholder={booking?.clientPhone} />
                  </div>
                  <div>
                    <label className="label-field">Email</label>
                    <input type="email" value={propSite.agentEmail || ""}
                      onChange={(e) => setPropField("agentEmail", e.target.value)}
                      className="input-field w-full" placeholder={booking?.clientEmail} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={savePropSite} disabled={savingPropSite} className="btn-primary px-8 py-3">
                {savingPropSite ? "Saving…" : "Save Property Website"}
              </button>
              {propSite.published && (
                <a
                  href={`/${tenantSlug || ""}/property/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-navy underline underline-offset-2 hover:opacity-70"
                >
                  Preview website →
                </a>
              )}
            </div>
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
