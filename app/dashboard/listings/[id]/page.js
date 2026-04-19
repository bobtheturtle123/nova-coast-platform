"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useToast } from "@/components/Toast";

// ─── Agent Image Field (upload file OR paste URL) ────────────────────────────
function AgentImageField({ label, value, onChange, folder, placeholder, hint, preview }) {
  const [mode,       setMode]       = useState("url");   // "url" | "upload"
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState("");
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, folder }),
      });
      if (!res.ok) { setUploadErr("Upload failed. Check storage config."); return; }
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onChange(publicUrl);
    } catch {
      setUploadErr("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label-field">{label}</label>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => setMode("url")}
            className={`transition-colors ${mode === "url" ? "text-navy font-semibold" : "text-gray-400 hover:text-gray-600"}`}>
            Paste URL
          </button>
          <button type="button" onClick={() => setMode("upload")}
            className={`transition-colors ${mode === "upload" ? "text-navy font-semibold" : "text-gray-400 hover:text-gray-600"}`}>
            Upload File
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        {/* Preview */}
        {value ? (
          preview === "circle" ? (
            <img src={value} alt={label} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" />
          ) : (
            <img src={value} alt={label} className="h-12 max-w-[120px] object-contain rounded border border-gray-100 bg-gray-50 p-1 flex-shrink-0" />
          )
        ) : (
          <div className={`flex-shrink-0 bg-gray-100 rounded flex items-center justify-center text-gray-400 ${preview === "circle" ? "w-12 h-12 rounded-full" : "h-12 w-20"}`}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <div className="flex-1">
          {mode === "url" ? (
            <input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="input-field w-full text-sm"
            />
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-sm py-3 text-sm text-gray-500 hover:border-navy/30 hover:text-navy transition-colors disabled:opacity-50">
                {uploading ? "Uploading…" : value ? "Replace image" : "Click to choose image"}
              </button>
              {uploadErr && <p className="text-xs text-red-500 mt-1">{uploadErr}</p>}
            </>
          )}
          {value && (
            <button type="button" onClick={() => onChange("")}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors mt-1">
              Remove
            </button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Date/Time Picker ────────────────────────────────────────────────────────
const TIME_OPTIONS = [
  "7:00 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
];
function timeToVal(label) {
  const [time, ampm] = label.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function valToLabel(val) {
  if (!val) return "";
  const [h, m] = val.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
}
function DateTimePicker({ date, time, onConfirm, onClose }) {
  const today = new Date();
  const initD = date ? new Date(date + "T12:00:00") : today;
  const [viewYear, setViewYear]   = useState(initD.getFullYear());
  const [viewMonth, setViewMonth] = useState(initD.getMonth());
  const [selDate, setSelDate]     = useState(date || "");
  const [selTime, setSelTime]     = useState(time || "");
  const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth = (y,m) => new Date(y,m+1,0).getDate();
  const firstDow    = (y,m) => new Date(y,m,1).getDay();
  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };
  const cells = [...Array(firstDow(viewYear,viewMonth)).fill(null), ...Array.from({length:daysInMonth(viewYear,viewMonth)},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const ds = (day) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={(e)=>e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">‹</button>
            <p className="font-semibold text-sm text-charcoal">{MONTHS[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">{DAYS.map(d=><div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {cells.map((day,i)=>{
              if(!day) return <div key={i}/>;
              const s=ds(day), isSel=selDate===s, isToday=s===todayStr, isPast=s<todayStr;
              return <button key={i} type="button" disabled={isPast} onClick={()=>setSelDate(s)}
                className={`w-8 h-8 mx-auto rounded-full text-sm transition-colors ${isSel?"bg-navy text-white font-semibold":isToday?"border border-navy text-navy font-semibold":isPast?"text-gray-200 cursor-not-allowed":"hover:bg-navy/10 text-charcoal"}`}>{day}</button>;
            })}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Time</p>
          <div className="grid grid-cols-5 gap-1 mb-4">
            {TIME_OPTIONS.map((t)=>{
              const v=timeToVal(t);
              return <button key={t} type="button" onClick={()=>setSelTime(v)}
                className={`py-1.5 text-xs rounded transition-colors ${selTime===v?"bg-navy text-white font-semibold":"bg-gray-50 hover:bg-navy/10 text-charcoal"}`}>{t}</button>;
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={()=>onConfirm("","")} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2">Clear</button>
            <div className="flex-1"/>
            <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={()=>onConfirm(selDate,selTime)} disabled={!selDate} className="btn-primary px-4 py-2 text-sm">Set Date</button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const toast   = useToast();

  const [booking,    setBooking]   = useState(null);
  const [gallery,    setGallery]   = useState(null);
  const [catalog,    setCatalog]   = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [tab,        setTab]       = useState("overview");
  const [showDeliver,  setShowDeliver]  = useState(false);
  const [delivering,   setDelivering]  = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailNote,    setEmailNote]   = useState("");
  const [deliveryMode, setDeliveryMode] = useState("now"); // "now" | "later"
  const [scheduledAt,  setScheduledAt]  = useState("");
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Property website state
  const [propSite,      setPropSite]      = useState({});
  const [savingPropSite, setSavingPropSite] = useState(false);
  const [propSiteMsg,   setPropSiteMsg]   = useState({ text: "", type: "" });
  const [tenantSlug,    setTenantSlug]    = useState("");

  // Marketing tab state
  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [captions,         setCaptions]         = useState(null);
  const [captionsLoading,  setCaptionsLoading]  = useState(false);
  const [listingUrl,       setListingUrl]        = useState("");

  // Agent access state
  const [sendingAgentAccess,  setSendingAgentAccess]  = useState(false);
  const [agentPortalUrl,      setAgentPortalUrl]      = useState("");
  const [agentAccessMsg,      setAgentAccessMsg]      = useState("");

  // QuickBooks sync state
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbMsg,     setQbMsg]     = useState("");

  // Invoice state
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceMsg,     setInvoiceMsg]     = useState("");

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
      if (tenant?.slug) {
        setTenantSlug(tenant.slug);
        setListingUrl(`${window.location.origin}/${tenant.slug}/property/${id}`);
        const catRes = await fetch(`/api/tenant-public/${tenant.slug}/catalog`);
        if (catRes.ok) setCatalog(await catRes.json());
      }
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
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setBooking((b) => ({ ...b, ...fields }));
        toast("Saved.");
      } else {
        toast("Failed to save.", "error");
      }
    } catch { toast("Something went wrong.", "error"); }
    finally { setSaving(false); }
  }

  async function sendAgentAccess(sendEmail = true) {
    setSendingAgentAccess(true);
    setAgentAccessMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`/api/dashboard/listings/${id}/send-agent-access`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ sendEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setAgentPortalUrl(data.portalUrl);
        setAgentAccessMsg(sendEmail ? `Portal link sent to ${booking?.clientEmail}` : "Portal link generated");
      } else {
        setAgentAccessMsg(data.error || "Failed to send agent access");
      }
    } catch {
      setAgentAccessMsg("Something went wrong");
    } finally {
      setSendingAgentAccess(false);
    }
  }

  async function syncToQB() {
    setQbSyncing(true);
    setQbMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch("/api/dashboard/quickbooks/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ bookingId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setQbMsg(data.skipped ? "Already synced to QuickBooks." : `Synced! Invoice #${data.invoiceId}`);
      } else {
        setQbMsg(data.error || "QuickBooks sync failed.");
      }
    } catch {
      setQbMsg("Something went wrong.");
    } finally {
      setQbSyncing(false);
    }
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
    if (deliveryMode === "later" && !scheduledAt) { toast("Pick a date and time.", "error"); return; }
    if (deliveryMode === "later" && new Date(scheduledAt) <= new Date()) {
      toast("Scheduled time must be in the future.", "error"); return;
    }
    setDelivering(true);
    const token = await auth.currentUser.getIdToken();
    const body  = {
      subject: emailSubject,
      note:    emailNote,
      ...(deliveryMode === "later" ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    };
    const res = await fetch(`/api/dashboard/galleries/${gallery.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setDelivering(false);
    setShowDeliver(false);
    if (res.ok) {
      if (deliveryMode === "later") {
        toast(`Delivery scheduled for ${new Date(scheduledAt).toLocaleString()}.`);
        setGallery((g) => ({ ...g, scheduledDelivery: { scheduledAt: new Date(scheduledAt), status: "pending" } }));
      } else {
        setGallery((g) => ({ ...g, delivered: true, scheduledDelivery: null }));
        toast("Gallery delivered to client.");
      }
    } else {
      toast("Failed to deliver.", "error");
    }
  }

  async function cancelScheduledDelivery() {
    if (!gallery) return;
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${gallery.id}/send`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast("Scheduled delivery cancelled.");
      setGallery((g) => ({ ...g, scheduledDelivery: null }));
    } else {
      toast("Failed to cancel.", "error");
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

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/listings/${id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    finally { setAnalyticsLoading(false); }
  }

  async function generateCaptions() {
    setCaptionsLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/listings/${id}/social-captions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setCaptions(data.captions);
    } catch {}
    finally { setCaptionsLoading(false); }
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
                <button onClick={() => { setDeliveryMode("now"); setScheduledAt(""); setShowDeliver(true); }}
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
            { id: "marketing", label: "Marketing" },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "marketing" && !analytics) loadAnalytics(); }}
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
        {/* Scheduled delivery banner */}
        {gallery?.scheduledDelivery?.status === "pending" && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Gallery delivery scheduled for{" "}
                {new Date(gallery.scheduledDelivery.scheduledAt?.toDate?.() || gallery.scheduledDelivery.scheduledAt)
                  .toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Email will send automatically at that time.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeliveryMode("later"); setShowDeliver(true); }}
                className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
              <button onClick={cancelScheduledDelivery}
                className="text-xs font-medium text-red-500 hover:underline">Cancel</button>
            </div>
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

              {/* Agent Portal Access */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Agent Portal</p>
                {agentPortalUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-navy flex-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate">{agentPortalUrl}</code>
                      <button onClick={() => { navigator.clipboard.writeText(agentPortalUrl); setAgentAccessMsg("Copied!"); }}
                        className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 flex-shrink-0">
                        Copy
                      </button>
                    </div>
                    <button onClick={() => sendAgentAccess(true)} disabled={sendingAgentAccess}
                      className="text-xs text-navy hover:underline">
                      Resend email
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => sendAgentAccess(true)} disabled={sendingAgentAccess || !booking.clientEmail}
                      className="text-xs bg-navy text-white px-3 py-1.5 rounded hover:bg-navy/90 disabled:opacity-40 transition-colors">
                      {sendingAgentAccess ? "Sending…" : "📧 Send Portal Link"}
                    </button>
                    <button onClick={() => sendAgentAccess(false)} disabled={sendingAgentAccess || !booking.clientEmail}
                      className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors">
                      Generate Link
                    </button>
                  </div>
                )}
                {agentAccessMsg && <p className="text-xs text-green-600 mt-1">{agentAccessMsg}</p>}
              </div>

              {/* QuickBooks */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">QuickBooks</p>
                <div className="flex items-center gap-2">
                  <button onClick={syncToQB} disabled={qbSyncing}
                    className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                    <span className="font-bold text-[#2CA01C]">QB</span>
                    {qbSyncing ? "Syncing…" : booking?.qbInvoiceId ? "Re-sync to QB" : "Sync to QuickBooks"}
                  </button>
                  {booking?.qbInvoiceId && !qbMsg && (
                    <span className="text-xs text-green-600">Invoice #{booking.qbInvoiceId}</span>
                  )}
                </div>
                {qbMsg && <p className="text-xs text-green-600 mt-1">{qbMsg}</p>}
              </div>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Scheduled Shoot
                    </label>
                    <button type="button" onClick={() => setShowDatePicker((v) => !v)}
                      className="text-xs text-navy hover:underline">
                      {showDatePicker ? "Cancel" : booking.shootDate ? "Edit" : "Set date"}
                    </button>
                  </div>
                  {booking.shootDate && !showDatePicker ? (
                    <p className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500 flex-shrink-0">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {shootDateDisplay}{booking.shootTime ? ` · ${booking.shootTime}` : ""}
                    </p>
                  ) : !showDatePicker ? (
                    <p className="text-sm text-gray-400">No shoot date set</p>
                  ) : null}
                  {showDatePicker && (
                    <div className="space-y-2 mt-1">
                      <button type="button" onClick={() => setShowDatePicker(true)}
                        className="input-field w-full text-left flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span className={shootDate ? "text-charcoal text-sm" : "text-gray-400 text-sm"}>
                          {shootDate
                            ? `${new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${shootTime ? ` · ${valToLabel(shootTime)}` : ""}`
                            : "Pick date & time"}
                        </span>
                      </button>
                      <button onClick={() => { patchBooking({ shootDate, shootTime }); setShowDatePicker(false); }} disabled={saving || !shootDate}
                        className="btn-primary w-full py-2 text-xs">
                        {saving ? "Saving…" : "Save Shoot Date"}
                      </button>
                    </div>
                  )}
                  {/* Additional appointments */}
                  {(booking.additionalAppointments || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(booking.additionalAppointments || []).map((appt, i) => (
                        <p key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          Appt {i + 2}: {appt.date ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD"}{appt.time ? ` · ${appt.time}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Services */}
            {(booking.packageId || booking.serviceIds?.length > 0 || booking.customLineItems?.length > 0) && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Services Booked</p>
                {(() => {
                  const allItems = [
                    ...(catalog?.packages || []),
                    ...(catalog?.services  || []),
                    ...(catalog?.addons    || []),
                  ];
                  const nameOf = (id) => allItems.find((x) => x.id === id)?.name || id;
                  return (
                    <div className="space-y-1.5">
                      {booking.packageId && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Package</span>
                          <span className="text-sm font-medium text-charcoal">{nameOf(booking.packageId)}</span>
                        </div>
                      )}
                      {booking.serviceIds?.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Service</span>
                          <span className="text-sm text-charcoal">{nameOf(s)}</span>
                        </div>
                      ))}
                      {booking.addonIds?.map((a) => (
                        <div key={a} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Add-on</span>
                          <span className="text-sm text-charcoal">{nameOf(a)}</span>
                        </div>
                      ))}
                      {booking.customLineItems?.map((l, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Custom</span>
                            <span className="text-sm text-charcoal">{l.label}</span>
                          </div>
                          <span className="text-sm font-medium text-navy">${l.price}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

            {/* Send Invoice button */}
            {!booking.paidInFull && !booking.balancePaid && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Send Invoice</p>
                <p className="text-sm text-gray-500 mb-4">
                  Email the client a payment link for their {booking.depositPaid ? "remaining balance" : "deposit"}.
                </p>
                <button
                  disabled={sendingInvoice}
                  onClick={async () => {
                    setSendingInvoice(true);
                    setInvoiceMsg("");
                    try {
                      const token = await auth.currentUser?.getIdToken(true);
                      const res = await fetch(`/api/dashboard/bookings/${id}/send-invoice`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        setInvoiceMsg("Invoice sent to " + booking.clientEmail);
                      } else {
                        const d = await res.json();
                        setInvoiceMsg(d.error || "Failed to send invoice.");
                      }
                    } catch { setInvoiceMsg("Failed to send invoice."); }
                    finally { setSendingInvoice(false); }
                  }}
                  className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
                >
                  {sendingInvoice ? "Sending…" : "Send Invoice Email"}
                </button>
                {invoiceMsg && (
                  <p className={`mt-3 text-xs ${invoiceMsg.startsWith("Invoice sent") ? "text-green-600" : "text-red-500"}`}>
                    {invoiceMsg}
                  </p>
                )}
              </div>
            )}

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

            {/* Template + Color Scheme */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-1">Template & Style</h3>
              <p className="text-xs text-gray-400 mb-5">Choose a layout and color scheme for the public property website.</p>

              {/* Template selector */}
              <div className="mb-5">
                <label className="label-field mb-2">Layout Template</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "modern",  label: "Modern",  desc: "Full-bleed hero, dark overlays" },
                    { id: "classic", label: "Classic", desc: "Clean white, contained hero" },
                    { id: "luxury",  label: "Luxury",  desc: "Editorial split, dark panels" },
                  ].map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => { setPropField("template", t.id); setPropField("colorPreset", "preset1"); }}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        (propSite.template || "modern") === t.id
                          ? "border-navy bg-navy/5"
                          : "border-gray-200 hover:border-navy/30"
                      }`}>
                      <p className={`text-sm font-semibold ${(propSite.template || "modern") === t.id ? "text-navy" : "text-charcoal"}`}>{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color preset */}
              {(() => {
                const PRESETS = {
                  modern:  [{ id: "preset1", label: "Navy & Gold",        primary: "#0b2a55", accent: "#c9a96e" }, { id: "preset2", label: "Charcoal & Emerald", primary: "#1a1a2e", accent: "#10b981" }],
                  classic: [{ id: "preset1", label: "Blue & Brass",       primary: "#1e3a5f", accent: "#b08d57" }, { id: "preset2", label: "Forest & Gold",      primary: "#1a3a2a", accent: "#c8a96e" }],
                  luxury:  [{ id: "preset1", label: "Obsidian & Champagne",primary: "#0d0d0d", accent: "#d4af8a" }, { id: "preset2", label: "Slate & Rose Gold",  primary: "#1e2433", accent: "#c9848a" }],
                };
                const tmpl   = propSite.template || "modern";
                const presets = PRESETS[tmpl] || PRESETS.modern;
                const current = propSite.colorPreset || "preset1";
                return (
                  <div>
                    <label className="label-field mb-2">Color Scheme</label>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((p) => (
                        <button key={p.id} type="button"
                          onClick={() => setPropField("colorPreset", p.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                            current === p.id ? "border-navy" : "border-gray-200 hover:border-navy/30"
                          }`}>
                          <span className="flex gap-1">
                            <span className="w-4 h-4 rounded-full border border-white/30 shadow-sm" style={{ background: p.primary }} />
                            <span className="w-4 h-4 rounded-full border border-white/30 shadow-sm" style={{ background: p.accent }} />
                          </span>
                          <span className={current === p.id ? "font-semibold text-navy" : "text-gray-600"}>{p.label}</span>
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setPropField("colorPreset", "custom")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                          current === "custom" ? "border-navy" : "border-gray-200 hover:border-navy/30"
                        }`}>
                        <span className={current === "custom" ? "font-semibold text-navy" : "text-gray-600"}>Custom…</span>
                      </button>
                    </div>
                    {current === "custom" && (
                      <div className="flex gap-4 mt-3">
                        <div>
                          <label className="label-field text-xs">Primary Color</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={propSite.customPrimary || "#0b2a55"}
                              onChange={(e) => setPropField("customPrimary", e.target.value)}
                              className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
                            <input type="text" value={propSite.customPrimary || "#0b2a55"}
                              onChange={(e) => setPropField("customPrimary", e.target.value)}
                              className="input-field w-28 text-xs font-mono" />
                          </div>
                        </div>
                        <div>
                          <label className="label-field text-xs">Accent Color</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={propSite.customAccent || "#c9a96e"}
                              onChange={(e) => setPropField("customAccent", e.target.value)}
                              className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
                            <input type="text" value={propSite.customAccent || "#c9a96e"}
                              onChange={(e) => setPropField("customAccent", e.target.value)}
                              className="input-field w-28 text-xs font-mono" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Display settings */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-5">Website Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="label-field">Custom Property Name</label>
                  <input type="text" value={propSite.customName || ""}
                    onChange={(e) => setPropField("customName", e.target.value)}
                    className="input-field w-full" placeholder={booking?.fullAddress || "Displays address by default"} />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to show the property address.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Property Status</label>
                    <select value={propSite.status || ""} onChange={(e) => setPropField("status", e.target.value)}
                      className="input-field w-full">
                      <option value="">— None —</option>
                      <option value="For Sale">For Sale</option>
                      <option value="Coming Soon">Coming Soon</option>
                      <option value="Pending">Pending</option>
                      <option value="Sold">Sold</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-field">MLS Live Date</label>
                    <input type="date" value={propSite.mlsLiveDate || ""}
                      onChange={(e) => setPropField("mlsLiveDate", e.target.value)}
                      className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">Status → "For Sale" automatically on this day.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm">
                  <div>
                    <p className="text-sm font-medium text-charcoal">Branded website</p>
                    <p className="text-xs text-gray-400">Show your business name and logo on the listing page</p>
                  </div>
                  <button type="button"
                    onClick={() => setPropField("branded", propSite.branded === false ? true : false)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${propSite.branded !== false ? "bg-navy" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${propSite.branded !== false ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Property details */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-5">Property Details</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Property Address</label>
                    <input type="text" value={propSite.address || ""}
                      onChange={(e) => setPropField("address", e.target.value)}
                      className="input-field w-full" placeholder={booking?.fullAddress || booking?.address} />
                  </div>
                  <div>
                    <label className="label-field">MLS Number</label>
                    <input type="text" value={propSite.mlsNumber || ""}
                      onChange={(e) => setPropField("mlsNumber", e.target.value)}
                      className="input-field w-full" placeholder="e.g. 24123456" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">Listing Price</label>
                    <input type="text" value={propSite.price || ""}
                      onChange={(e) => setPropField("price", e.target.value)}
                      className="input-field w-full" placeholder="$450,000" />
                  </div>
                  <div>
                    <label className="label-field">Property Type</label>
                    <select value={propSite.type || ""} onChange={(e) => setPropField("type", e.target.value)}
                      className="input-field w-full">
                      <option value="">— Select —</option>
                      <option value="Single Family">Single Family</option>
                      <option value="Condo / Townhome">Condo / Townhome</option>
                      <option value="Multi-Family">Multi-Family</option>
                      <option value="Land">Land</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Luxury Estate">Luxury Estate</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
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
                  <div>
                    <label className="label-field">Lot Acres</label>
                    <input type="text" value={propSite.lotAcres || ""}
                      onChange={(e) => setPropField("lotAcres", e.target.value)}
                      className="input-field w-full" placeholder="0.25" />
                  </div>
                  <div>
                    <label className="label-field">Parking Spots</label>
                    <input type="text" value={propSite.parking || ""}
                      onChange={(e) => setPropField("parking", e.target.value)}
                      className="input-field w-full" placeholder="2" />
                  </div>
                  <div>
                    <label className="label-field">Year Built</label>
                    <input type="text" value={propSite.yearBuilt || ""}
                      onChange={(e) => setPropField("yearBuilt", e.target.value)}
                      className="input-field w-full" placeholder="2005" />
                  </div>
                </div>
                <div>
                  <label className="label-field">Property Description</label>
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
                <div>
                  <label className="label-field">Video Tour URL (YouTube / Vimeo)</label>
                  <input type="url" value={propSite.videoUrl || ""}
                    onChange={(e) => setPropField("videoUrl", e.target.value)}
                    className="input-field w-full" placeholder="https://youtube.com/watch?v=..." />
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
                    <label className="label-field">Brokerage / Company</label>
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

                {/* Agent headshot */}
                <AgentImageField
                  label="Agent Headshot"
                  value={propSite.agentPhoto || ""}
                  onChange={(url) => setPropField("agentPhoto", url)}
                  folder="agent-photos"
                  placeholder="https://..."
                  preview="circle"
                />

                {/* Company / brokerage logo */}
                <AgentImageField
                  label="Brokerage Logo"
                  value={propSite.agentLogoUrl || ""}
                  onChange={(url) => setPropField("agentLogoUrl", url)}
                  folder="agent-logos"
                  placeholder="https://... or upload"
                  hint="Shown on the property website and brochure next to the agent card."
                  preview="rect"
                />
              </div>
            </div>

            {/* Agent Custom Domain (per-listing) */}
            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-base mb-1">Agent Custom Domain</h3>
              <p className="text-xs text-gray-400 mb-4">
                Let the agent use their own domain (e.g. <code className="bg-gray-100 px-1 rounded">123mainst.agentdomain.com</code>) for this property website.
                They'll need to add a CNAME record pointing to <code className="bg-gray-100 px-1 rounded">cname.vercel-dns.com</code>.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={propSite.agentCustomDomain || ""}
                  onChange={(e) => setPropField("agentCustomDomain", e.target.value.toLowerCase().trim())}
                  className="input-field flex-1"
                  placeholder="123mainst.agentdomain.com"
                />
                {propSite.agentCustomDomain && (
                  <button type="button" onClick={() => setPropField("agentCustomDomain", "")}
                    className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Save the property website above to apply the domain change.</p>
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

        {/* ── MARKETING TAB ─────────────────────────────────────────────────── */}
        {tab === "marketing" && (
          <div className="max-w-3xl space-y-6">

            {/* Listing URL */}
            {listingUrl && propSite.published && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Listing URL</p>
                <div className="flex gap-2 items-center">
                  <input readOnly value={listingUrl}
                    className="flex-1 input-field text-sm bg-gray-50 text-gray-600" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(listingUrl); }}
                    className="px-4 py-2 text-sm font-medium rounded-sm bg-navy text-white hover:bg-navy/90 transition-colors flex-shrink-0">
                    Copy
                  </button>
                  <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium rounded-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
                    ↗ Open
                  </a>
                </div>
                {!propSite.published && (
                  <p className="text-xs text-amber-600 mt-2">Publish the property website first to get a shareable URL.</p>
                )}
              </div>
            )}

            {/* Analytics */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Listing Analytics</p>
                <button onClick={loadAnalytics} disabled={analyticsLoading}
                  className="text-xs text-navy hover:underline disabled:opacity-50">
                  {analyticsLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>
              {analyticsLoading && !analytics ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-navy">{analytics?.views ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Page Views</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-navy">{analytics?.inquiries?.length ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Inquiries</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-navy">
                      {analytics?.views && analytics?.inquiries?.length
                        ? `${((analytics.inquiries.length / analytics.views) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Conversion</p>
                  </div>
                </div>
              )}
              {analytics?.lastViewedAt && (
                <p className="text-xs text-gray-400">
                  Last viewed: {new Date(analytics.lastViewedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* QR Code + Brochure row */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* QR Code */}
              {listingUrl && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">QR Code</p>
                  <div className="flex items-start gap-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=120x120&margin=4`}
                      alt="QR Code"
                      className="w-24 h-24 border border-gray-100 rounded-lg"
                    />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-gray-600 leading-snug">Perfect for yard signs, flyers, and business cards.</p>
                      <a
                        href={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(listingUrl)}&size=600x600&margin=10`}
                        download="listing-qr.png"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-medium text-navy hover:underline">
                        ↓ Download high-res QR
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Brochure */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Print Brochure</p>
                <p className="text-sm text-gray-600 mb-4 leading-snug">One-page property brochure with photos, stats, agent info, and QR code. Ready to print or save as PDF.</p>
                {tenantSlug ? (
                  <a
                    href={`/${tenantSlug}/property/${id}/brochure`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-sm bg-navy text-white hover:bg-navy/90 transition-colors">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Open Brochure →
                  </a>
                ) : (
                  <p className="text-xs text-gray-400">Save the property website first to generate a brochure.</p>
                )}
              </div>
            </div>

            {/* Social captions generator */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">AI Marketing Captions</p>
                  <p className="text-xs text-gray-400 mt-0.5">Instagram, Facebook, and email subject — generated instantly</p>
                </div>
                <button onClick={generateCaptions} disabled={captionsLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-sm bg-navy text-white hover:bg-navy/90 transition-colors disabled:opacity-50">
                  {captionsLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>✨ {captions ? "Regenerate" : "Generate Captions"}</>
                  )}
                </button>
              </div>

              {captions ? (
                <div className="space-y-4">
                  {[
                    { label: "Instagram", icon: "📸", key: "instagram", rows: 3 },
                    { label: "Facebook",  icon: "📘", key: "facebook",  rows: 3 },
                    { label: "Email Subject", icon: "✉️", key: "emailSubject", rows: 1 },
                  ].map(({ label, icon, key, rows }) => (
                    captions[key] && (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-gray-500">{icon} {label}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(captions[key])}
                            className="text-xs text-navy hover:underline">
                            Copy
                          </button>
                        </div>
                        <textarea readOnly value={captions[key]} rows={rows}
                          className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg resize-none text-gray-700 leading-relaxed" />
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">
                  Click "Generate Captions" to create ready-to-post marketing copy for this listing.
                </div>
              )}
            </div>

            {/* Inquiries */}
            {analytics?.inquiries?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
                  Inquiries ({analytics.inquiries.length})
                </p>
                <div className="divide-y divide-gray-100">
                  {analytics.inquiries.map((inq) => (
                    <div key={inq.id} className="py-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="font-medium text-charcoal">{inq.name}</p>
                        <a href={`mailto:${inq.email}`} className="text-xs text-navy hover:underline">{inq.email}</a>
                        {inq.phone && <p className="text-xs text-gray-400">{inq.phone}</p>}
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600 leading-snug">{inq.message}</p>
                        {inq.createdAt && (
                          <p className="text-xs text-gray-400 mt-1">{new Date(inq.createdAt).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analytics && analytics.inquiries?.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
                No inquiries yet. Share the listing URL to start getting leads.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deliver modal */}
      {showDeliver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
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

              {/* When to send */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">When to Send</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {[["now", "Send Now"], ["later", "Schedule"]].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setDeliveryMode(val)}
                      className={`flex-1 py-2 font-medium transition-colors ${
                        deliveryMode === val ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {deliveryMode === "later" && (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      min={(() => { const d = new Date(); d.setMinutes(d.getMinutes() + 15); return d.toISOString().slice(0,16); })()}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="input-field w-full"
                    />
                    <p className="text-xs text-gray-400 mt-1">Email delivers automatically at this time. You can cancel it before then.</p>
                  </div>
                )}
              </div>

              {/* Preview */}
              {deliveryMode === "now" && (
                <div className="bg-gray-50 rounded-sm p-4 text-sm text-gray-600 space-y-2">
                  <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Preview</p>
                  <p>Hi {booking.clientName?.split(" ")[0] || "there"},</p>
                  {emailNote && <p className="italic text-gray-500">{emailNote}</p>}
                  <p>Your media for <strong>{address}</strong> is ready to view and download.</p>
                  <p className="text-navy underline text-xs">[ View Gallery → ]</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowDeliver(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button
                onClick={deliverGallery}
                disabled={delivering || (deliveryMode === "later" && !scheduledAt)}
                className="btn-primary px-6 py-2 text-sm">
                {delivering
                  ? (deliveryMode === "later" ? "Scheduling…" : "Sending…")
                  : deliveryMode === "later" ? "Schedule Delivery →" : "Deliver →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDatePicker && (
        <DateTimePicker
          date={shootDate}
          time={shootTime}
          onConfirm={(d, t) => { setShootDate(d); setShootTime(t); setShowDatePicker(false); }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
