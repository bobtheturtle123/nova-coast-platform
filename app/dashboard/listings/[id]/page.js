"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { getAppUrl } from "@/lib/appUrl";
import WeatherWidget from "@/components/dashboard/WeatherWidget";
import { useTenantSettings, formatCurrency } from "@/lib/TenantSettingsContext";

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
            className={`transition-colors ${mode === "url" ? "text-[#3486cf] font-semibold" : "text-gray-400 hover:text-gray-600"}`}>
            Paste URL
          </button>
          <button type="button" onClick={() => setMode("upload")}
            className={`transition-colors ${mode === "upload" ? "text-[#3486cf] font-semibold" : "text-gray-400 hover:text-gray-600"}`}>
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
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:border-[#3486cf]/30 hover:text-[#3486cf] transition-colors disabled:opacity-50">
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
    <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="modal-card relative w-full max-w-sm" onClick={(e)=>e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">‹</button>
            <p className="font-semibold text-sm text-[#0F172A]">{MONTHS[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">›</button>
          </div>
          <div className="grid grid-cols-7 mb-1">{DAYS.map(d=><div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {cells.map((day,i)=>{
              if(!day) return <div key={i}/>;
              const s=ds(day), isSel=selDate===s, isToday=s===todayStr, isPast=s<todayStr;
              return <button key={i} type="button" disabled={isPast} onClick={()=>setSelDate(s)}
                className={`w-8 h-8 mx-auto rounded-full text-sm transition-colors ${isSel?"bg-[#3486cf] text-white font-semibold":isToday?"border border-[#3486cf] text-[#3486cf] font-semibold":isPast?"text-gray-200 cursor-not-allowed":"hover:bg-[#3486cf]/10 text-[#0F172A]"}`}>{day}</button>;
            })}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Time</p>
          <div className="grid grid-cols-5 gap-1 mb-4">
            {TIME_OPTIONS.map((t)=>{
              const v=timeToVal(t);
              return <button key={t} type="button" onClick={()=>setSelTime(v)}
                className={`py-1.5 text-xs rounded transition-colors ${selTime===v?"bg-[#3486cf] text-white font-semibold":"bg-gray-50 hover:bg-[#3486cf]/10 text-[#0F172A]"}`}>{t}</button>;
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


export default function ListingDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const toast   = useToast();
  const { tempUnit, locale, currency } = useTenantSettings();

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
  const [showReschedModal,    setShowReschedModal]    = useState(false);
  const [reschedDate,         setReschedDate]         = useState("");
  const [reschedTime,         setReschedTime]         = useState("");
  const [reschedApptIdx,      setReschedApptIdx]      = useState(null); // null = main booking, number = additional appt index
  const [showReschedDtPicker, setShowReschedDtPicker] = useState(false);
  const [schedApprovalDate,     setSchedApprovalDate]     = useState("");
  const [schedApprovalTime,     setSchedApprovalTime]     = useState("");
  const [schedApprovalSaving,   setSchedApprovalSaving]   = useState(false);
  const [schedApprovalMsg,      setSchedApprovalMsg]      = useState("");

  // Property website state
  const [propSite,      setPropSite]      = useState({});
  const [savingPropSite, setSavingPropSite] = useState(false);
  const [propSiteMsg,   setPropSiteMsg]   = useState({ text: "", type: "" });
  const [tenantSlug,    setTenantSlug]    = useState("");
  const [showWeather,   setShowWeather]   = useState(true);

  // Marketing tab state
  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
const [listingUrl,       setListingUrl]        = useState("");

  // Agent access state
  const [sendingAgentAccess, setSendingAgentAccess] = useState(false);
  const [agentAccessMsg,     setAgentAccessMsg]     = useState("");

  // Invoice state
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceMsg,     setInvoiceMsg]     = useState("");

  // Payment reminder state
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMsg,     setReminderMsg]     = useState("");

  // Deposit request state
  const [sendingDeposit, setSendingDeposit] = useState(false);
  const [depositLinkMsg, setDepositLinkMsg] = useState("");
  const [depositUrl,     setDepositUrl]     = useState("");

  // Cancel / hide state
  const [cancelling,  setCancelling]  = useState(false);
  const [hiding,      setHiding]      = useState(false);

  // Role-based access
  const [userRole, setUserRole] = useState("owner"); // "owner" | "admin" | "manager"
  const [convertingToListing, setConvertingToListing] = useState(false);

  // Autofill (MLS / Redfin)
  const [autofillSource, setAutofillSource] = useState("");
  const [autofilling,    setAutofilling]    = useState(false);
  const [autofillMsg,    setAutofillMsg]    = useState("");

  async function convertToListing() {
    setConvertingToListing(true);
    try {
      const token = await auth.currentUser?.getIdToken(true);
      const res = await fetch(`/api/dashboard/bookings/${id}/create-listing`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBooking((b) => ({ ...b, isListing: true }));
        setConvertingToListing(false);
        return;
      }
      const d = await res.json().catch(() => ({}));
      alert(d.error || `Failed to create listing (${res.status})`);
    } catch (e) {
      alert(e.message || "Unexpected error");
    }
    setConvertingToListing(false);
  }

  // Activity log
  const [activityLog,     setActivityLog]     = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Revisions
  const [revisions,        setRevisions]        = useState(null); // null = not yet loaded
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revFilter,        setRevFilter]        = useState("all");
  const [revExpanded,      setRevExpanded]      = useState(null);
  const [revNotes,         setRevNotes]         = useState({});
  const [revSaving,        setRevSaving]        = useState(null);

  useEffect(() => {
    load();
  }, [id]);

  async function loadActivity(galleryId) {
    if (!galleryId) return;
    setActivityLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/dashboard/galleries/${galleryId}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setActivityLog(d.events || []); }
    } catch { /* ignore */ }
    setActivityLoading(false);
  }

  async function loadRevisions() {
    setRevisionsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res   = await fetch(`/api/dashboard/revisions?bookingId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data  = await res.json();
      setRevisions(data.revisions || []);
    } catch { setRevisions([]); }
    setRevisionsLoading(false);
  }

  async function updateRevisionStatus(revId, status) {
    setRevSaving(revId);
    const token = await auth.currentUser?.getIdToken();
    await fetch(`/api/dashboard/revisions/${revId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ status, adminNotes: revNotes[revId] || "" }),
    });
    setRevSaving(null);
    loadRevisions();
  }

  async function load() {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) return;

    // Get user role from claims
    const result = await auth.currentUser.getIdTokenResult();
    setUserRole(result.claims?.role || "owner");

    const [bRes, gRes, tRes] = await Promise.all([
      fetch(`/api/dashboard/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/dashboard/listings/${id}/gallery`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (tRes.ok) {
      const { tenant } = await tRes.json();
      if (tenant?.slug) {
        setTenantSlug(tenant.slug);
        setListingUrl(`${getAppUrl()}/${tenant.slug}/property/${id}`);
        const catRes = await fetch(`/api/tenant-public/${tenant.slug}/catalog`);
        if (catRes.ok) setCatalog(await catRes.json());
      }
      setShowWeather(tenant?.availability?.showWeather ?? true);
    }

    if (bRes.ok) {
      const { booking: b } = await bRes.json();
      setBooking(b);
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
        setAgentAccessMsg(`Invite sent to ${booking?.clientEmail}`);
      } else {
        setAgentAccessMsg(data.error || "Failed to send agent access");
      }
    } catch {
      setAgentAccessMsg("Something went wrong");
    } finally {
      setSendingAgentAccess(false);
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

  async function retryScheduledDelivery() {
    if (!gallery) return;
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`/api/dashboard/galleries/${gallery.id}/send`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      toast("Delivery queued for retry — will send within 15 minutes.");
      setGallery((g) => ({
        ...g,
        scheduledDelivery: { ...g.scheduledDelivery, status: "pending", scheduledAt: new Date(data.retryAt) },
      }));
    } else {
      toast("Failed to retry.", "error");
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
        body: JSON.stringify({ propertyWebsite: { ...propSite, features: (propSite.features || []).filter((f) => f.trim()) } }),
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

  async function handleAutofill() {
    if (!autofillSource.trim()) return;
    setAutofilling(true);
    setAutofillMsg("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/dashboard/listings/${id}/autofill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: autofillSource.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.fields && Object.keys(data.fields).length > 0) {
        Object.entries(data.fields).forEach(([k, v]) => setPropField(k, v));
        setAutofillMsg("Fields filled in — review and save.");
      } else {
        setAutofillMsg(data.message || "No data found for that source.");
      }
    } catch {
      setAutofillMsg("Auto-fill failed. Enter details manually.");
    } finally {
      setAutofilling(false);
    }
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

if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
    </div>
  );
  if (!booking) return (
    <div className="p-8 text-gray-500">
      Listing not found.
      <Link href="/dashboard/listings" className="block mt-2 text-[#3486cf] text-sm hover:underline">← Back to listings</Link>
    </div>
  );

  if (booking.isListing === false) return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg-base)" }}>
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-amber-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A] mb-1">{booking.fullAddress || booking.address || "This booking"}</h2>
        <p className="text-sm text-gray-500 mb-6">This booking hasn't been activated as a listing yet. Creating a listing enables the agent portal, gallery delivery, and client-facing features.</p>
        <button
          onClick={convertToListing}
          disabled={convertingToListing}
          className="w-full py-2.5 px-6 rounded-xl bg-[#3486cf] text-white font-semibold text-sm hover:bg-[#2a72b8] transition-colors disabled:opacity-60">
          {convertingToListing ? "Creating listing…" : "Create Listing"}
        </button>
        <Link href="/dashboard/bookings" className="block mt-3 text-xs text-gray-400 hover:text-gray-600">← Back to bookings</Link>
      </div>
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
  const canViewRevenue = userRole !== "manager";
  const balanceDue = !booking.paidInFull && !booking.balancePaid;

  // Stepper state computation
  const wfStatus   = resolveWorkflowStatus(booking, { gallery, revisions: revisions ?? undefined });
  const isShootPast = booking.shootDate && new Date((booking.shootDate.split("T")[0]) + "T23:59:00") < new Date();
  const hasPhotog   = !!(booking.photographerId || booking.photographerName);
  const hasMedia    = (gallery?.media?.length || 0) > 0;
  const isDelivered = !!gallery?.delivered;

  const STEPS = [
    { label: "Booked",     sub: null },
    { label: "Confirmed",  sub: booking.shootDate ? new Date((booking.shootDate.split("T")[0]) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null },
    { label: "Assigned",   sub: booking.photographerName || null },
    { label: "Shot",       sub: isShootPast ? "Complete" : null },
    { label: "Editing",    sub: null },
    { label: "QA",         sub: null },
    { label: "Delivered",  sub: null },
  ];

  function stepState(i) {
    if (isDelivered)  return i < 7 ? "done" : "done";
    if (i === 0)      return "done";
    if (i === 1)      return (booking.shootDate || booking.scheduleApprovalStatus === "confirmed") ? "done" : "none";
    if (i === 2)      return hasPhotog ? "done" : "none";
    if (i === 3)      return isShootPast ? "done" : "none";
    if (i === 4)      return (isShootPast && hasMedia) ? "active" : (isShootPast ? "none" : "none");
    if (i === 5)      return wfStatus === "revisions" ? "active" : "none";
    if (i === 6)      return "none";
    return "none";
  }

  // Determine first non-done step as active if no explicit active step
  const firstActive = STEPS.findIndex((_, i) => stepState(i) === "active");
  const firstNone   = STEPS.findIndex((_, i) => stepState(i) === "none");
  const activeIdx   = firstActive >= 0 ? firstActive : (isDelivered ? 6 : firstNone >= 0 ? firstNone : 0);

  const nextHint = isDelivered ? (wfStatus === "completed" ? "Listing complete and paid" : "Listing delivered") :
    wfStatus === "revisions" ? "Address revision requests then re-deliver" :
    !booking.shootDate ? "Confirm the shoot date and time" :
    !hasPhotog ? "Assign a photographer" :
    !isShootPast ? `Complete the shoot on ${STEPS[1].sub || "scheduled date"}` :
    !hasMedia ? "Upload media to the gallery" :
    "Review and deliver the gallery";

  // Deliver readiness checklist
  const readinessItems = [
    { label: "Media uploaded",      done: hasMedia },
    { label: "Payment on file",     done: !!(booking.depositPaid || booking.paidInFull) },
    { label: "Property site saved", done: !!(propSite.address && propSite.beds) },
  ];
  const readinessPct = Math.round((readinessItems.filter((x) => x.done).length / readinessItems.length) * 100);

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-7 pt-4 pb-0" style={{ fontSize: 12, color: "#9CA3AF" }}>
        <Link href="/dashboard/listings" className="hover:text-[#3486cf] transition-colors">Listings</Link>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span className="text-[#0F172A] font-medium truncate max-w-xs">{address}</span>
      </div>

      {/* Hero */}
      <div className="mx-7 mt-3.5 rounded-[18px] overflow-hidden relative" style={{ height: 240, background: "#1f2733" }}>
        {coverUrl
          ? <img src={coverUrl} alt={address} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#2c3a4d,#1a2230)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(15,23,42,.12) 0%,rgba(15,23,42,.75) 100%)" }} />

        {/* Balance strip */}
        {balanceDue && booking.remainingBalance > 0 && (
          <div className="absolute top-0 left-0 right-0 z-10 text-center text-white font-semibold" style={{ fontSize: 11.5, padding: "6px 12px", background: "rgba(217,119,6,0.95)", backdropFilter: "blur(4px)" }}>
            Balance due {formatCurrency(booking.remainingBalance, currency, locale)} · collected automatically when you deliver
          </div>
        )}

        <div className="absolute inset-0 flex flex-col justify-between p-6" style={{ paddingTop: (balanceDue && booking.remainingBalance > 0) ? 36 : 22 }}>
          {/* Top row: badges + quick actions */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {booking.id && (
                <span className="text-white font-semibold rounded-full" style={{ fontSize: 11, padding: "4px 11px", background: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)" }}>
                  #{booking.id.slice(-6).toUpperCase()}
                </span>
              )}
              <span className="font-semibold rounded-full" style={{ fontSize: 11, padding: "4px 11px", background: "#C9A96E", color: "#1a1205" }}>
                <WorkflowStatusBadge status={wfStatus} size="xs" className="inline" />
              </span>
              {balanceDue && booking.remainingBalance > 0 && (
                <span className="font-semibold rounded-full text-white" style={{ fontSize: 11, padding: "4px 11px", background: "rgba(217,119,6,0.92)" }}>
                  Balance due {formatCurrency(booking.remainingBalance, currency, locale)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowDeliver(true)}
                className="btn-primary text-xs font-semibold rounded-[9px] h-9 px-4" style={{ fontSize: 13 }}>
                Deliver →
              </button>
              <a href={`mailto:${booking.clientEmail}`} title="Message client"
                className="w-9 h-9 rounded-[9px] flex items-center justify-center border border-white/20 text-white hover:bg-white/20 transition-colors" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)" }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
              {propSite.published && tenantSlug && (
                <a href={`/${tenantSlug}/property/${id}`} target="_blank" rel="noopener noreferrer" title="Open public site"
                  className="w-9 h-9 rounded-[9px] flex items-center justify-center border border-white/20 text-white hover:bg-white/20 transition-colors" style={{ background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)" }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              )}
            </div>
          </div>

          {/* Bottom: address + meta */}
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.4px", lineHeight: 1.1 }}>
              {address}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap" style={{ color: "rgba(255,255,255,0.82)", fontSize: 13 }}>
              {(booking.squareFootage || booking.sqft) && <span>{(booking.squareFootage || booking.sqft).toLocaleString()} sqft</span>}
              {propSite.beds && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.5)", display: "inline-block" }} /><span>{propSite.beds} BD</span></>}
              {propSite.baths && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.5)", display: "inline-block" }} /><span>{propSite.baths} BA</span></>}
              {(() => {
                const allItems = [...(catalog?.packages||[]),...(catalog?.services||[]),...(catalog?.addons||[])];
                const pkgIds = booking.packageIds?.length > 0 ? booking.packageIds : (booking.packageId ? [booking.packageId] : []);
                const pkgName = pkgIds[0] ? (allItems.find((x) => x.id === pkgIds[0])?.name || null) : null;
                return pkgName ? <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.5)", display: "inline-block" }} /><span>{pkgName}</span></> : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="mx-7 mt-4 bg-white rounded-2xl border border-gray-200" style={{ padding: "18px 22px" }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>Workflow</span>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Next: <b style={{ color: "#0F172A" }}>{nextHint}</b></span>
        </div>
        <div className="flex items-start">
          {STEPS.map((step, i) => {
            const state = isDelivered ? "done" : i < activeIdx ? "done" : i === activeIdx ? "active" : "none";
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 relative">
                {i > 0 && (
                  <div className="absolute" style={{ left: "-50%", right: "50%", top: 14, height: 1.6, background: (state === "done" || (i <= activeIdx)) ? "#059669" : "#E5E7EB", zIndex: 1 }} />
                )}
                <div className="w-7 h-7 rounded-full flex items-center justify-center relative z-10 text-xs font-bold" style={{
                  background: state === "done" ? "#059669" : state === "active" ? "#fff" : "#fff",
                  border: state === "done" ? "1.6px solid #059669" : state === "active" ? "1.6px solid #3486cf" : "1.6px solid #E5E7EB",
                  color: state === "done" ? "#fff" : state === "active" ? "#3486cf" : "#9CA3AF",
                  boxShadow: state === "active" ? "0 0 0 4px #EEF4FA" : "none",
                }}>
                  {state === "done" ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: state === "done" ? "#0F172A" : state === "active" ? "#3486cf" : "#9CA3AF", textAlign: "center" }}>{step.label}</span>
                {step.sub && <span style={{ fontSize: 10, color: "#9CA3AF" }}>{step.sub}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 mt-4" style={{ paddingLeft: 28, paddingRight: 28 }}>
        <div className="flex items-center justify-between">
          <div className="flex gap-0">
            {[
              { id: "overview",  label: "Overview" },
              { id: "orders",    label: "Payments" },
              { id: "gallery",   label: "Gallery" },
              { id: "property",  label: "Property Site" },
              { id: "marketing", label: "Marketing" },
              { id: "revisions", label: "Revisions", badge: revisions ? revisions.filter((r) => r.status === "pending").length : 0 },
              { id: "activity",  label: "Activity" },
            ].map((t) => (
              <button key={t.id} onClick={() => {
                setTab(t.id);
                if (t.id === "marketing" && !analytics) loadAnalytics();
                if (t.id === "activity" && activityLog.length === 0) loadActivity(gallery?.id);
                if (t.id === "revisions" && revisions === null) loadRevisions();
              }}
                className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${tab === t.id ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                {t.label}
                {t.badge > 0 && <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "1px 6px" }}>{t.badge}</span>}
              </button>
            ))}
          </div>
          <button onClick={openGalleryEditor}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#3486cf] text-white hover:bg-[#2a6dab] transition-colors my-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Upload Media
          </button>
        </div>
      </div>

      <div className="px-7 py-5 max-w-[1200px]">
        {/* Scheduled delivery banner */}
        {gallery?.scheduledDelivery && ["pending", "processing", "error"].includes(gallery.scheduledDelivery.status) && (() => {
          const status = gallery.scheduledDelivery.status;
          const ts = gallery.scheduledDelivery.scheduledAt;
          const d = ts?.toDate?.() ?? (ts?._seconds ? new Date(ts._seconds * 1000) : new Date(ts));
          const timeStr = isNaN(d?.getTime()) ? null : d.toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
          });
          const isPending    = status === "pending";
          const isProcessing = status === "processing";
          const isError      = status === "error";
          const bg    = isError ? "bg-red-50 border-red-200"   : isProcessing ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200";
          const title = isError ? "text-red-900"               : isProcessing ? "text-amber-900"               : "text-blue-900";
          const sub   = isError ? "text-red-600"               : isProcessing ? "text-amber-600"               : "text-blue-600";
          return (
            <div className={`mb-4 flex items-center justify-between border rounded-lg px-4 py-3 ${bg}`}>
              <div>
                {isProcessing && (
                  <p className={`text-sm font-medium ${title}`}>Sending now…</p>
                )}
                {isPending && (
                  <p className={`text-sm font-medium ${title}`}>
                    Gallery delivery scheduled for {timeStr ?? "—"}
                  </p>
                )}
                {isError && (
                  <p className={`text-sm font-medium ${title}`}>
                    Delivery failed{timeStr ? ` — was scheduled for ${timeStr}` : ""}
                  </p>
                )}
                <p className={`text-xs mt-0.5 ${sub}`}>
                  {isProcessing && "This delivery is being processed — refresh in a moment."}
                  {isPending    && "Email will send automatically at the scheduled time."}
                  {isError      && "An error occurred. Retry to attempt delivery again within 15 min."}
                </p>
              </div>
              <div className="flex gap-3">
                {isPending && (
                  <button onClick={() => { setDeliveryMode("later"); setShowDeliver(true); }}
                    className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
                )}
                {isError && (
                  <button onClick={retryScheduledDelivery}
                    className="text-xs font-medium text-amber-700 hover:underline">Retry</button>
                )}
                {!isProcessing && (
                  <button onClick={cancelScheduledDelivery}
                    className={`text-xs font-medium hover:underline ${isError ? "text-red-600" : "text-red-500"}`}>Cancel</button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px", alignItems: "start" }}>
            {/* ── Main column ── */}
            <div className="space-y-4">
            {/* Client / Agent */}
            <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
              <div className="px-[18px] py-3.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-[#0F172A]">Agent / Client</span>
                <Link href={`/dashboard/bookings/${id}/edit`} className="text-xs text-[#3486cf] font-semibold">Edit</Link>
              </div>
              <div className="p-[18px]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "#3486cf", fontSize: 15 }}>
                    {(booking.clientName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0F172A]" style={{ fontSize: 15 }}>{booking.clientName}</p>
                    <p className="text-gray-500" style={{ fontSize: 12.5 }}>{booking.clientEmail}</p>
                    {booking.clientPhone && <p className="text-gray-500" style={{ fontSize: 12.5 }}>{booking.clientPhone}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3.5">
                  {booking.clientEmail && (
                    <a href={`mailto:${booking.clientEmail}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Email
                    </a>
                  )}
                  {booking.clientPhone && (
                    <a href={`tel:${booking.clientPhone}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      Call
                    </a>
                  )}
                  <button onClick={() => sendAgentAccess(true)} disabled={sendingAgentAccess}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    {sendingAgentAccess ? "Sending…" : "Portal access"}
                  </button>
                </div>
                {agentAccessMsg && <p className="text-xs text-green-600 mt-2">{agentAccessMsg}</p>}
                {booking.notes && (
                  <div className="mt-3.5 p-3 rounded-[10px]" style={{ background: "#FAFAFA", borderLeft: "3px solid #C9A96E" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#A8843F" }}>Note</p>
                    <p className="text-[#4B5261] italic leading-relaxed" style={{ fontSize: 12.5 }}>"{booking.notes}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shoot Details */}
            <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
              <div className="px-[18px] py-3.5 border-b border-gray-100">
                <span className="text-[13.5px] font-bold text-[#0F172A]">Shoot Details</span>
              </div>
              <div className="p-[18px] space-y-0">
                {/* shoot date row */}
                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                  <span className="text-[12.5px] text-gray-500 flex items-center gap-2">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Shoot date
                  </span>
                  <span className="font-semibold text-[#0F172A] text-[13px] flex items-center gap-2">
                    {booking.shootDate ? <>{shootDateDisplay}{booking.shootTime ? ` · ${valToLabel(booking.shootTime)}` : ""}</> : <span className="text-gray-400 font-normal">Not set</span>}
                    {booking.shootDate && (
                      <button type="button" onClick={() => { setReschedApptIdx(null); setReschedDate(booking.shootDate?.split?.("T")?.[0] || ""); setReschedTime(booking.shootTime || ""); setShowReschedModal(true); }}
                        className="text-[11px] text-[#3486cf] font-semibold">Reschedule</button>
                    )}
                  </span>
                </div>
                {/* photographer row */}
                <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                  <span className="text-[12.5px] text-gray-500 flex items-center gap-2">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Photographer
                  </span>
                  <span className="font-semibold text-[#0F172A] text-[13px] flex items-center gap-2">
                    {booking.photographerName || <span className="text-gray-400 font-normal">Unassigned</span>}
                    <Link href={`/dashboard/bookings/${id}/edit`} className="text-[11px] text-[#3486cf] font-semibold">Reassign</Link>
                  </span>
                </div>
                {/* payment status row */}
                {canViewRevenue && (
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                    <span className="text-[12.5px] text-gray-500">Payment</span>
                    <select
                      value={booking.paidInFull || booking.balancePaid ? "paid_full" : booking.depositPaid ? "deposit_paid" : "unpaid"}
                      disabled={userRole === "manager"}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "paid_full")         patchBooking({ depositPaid: true,  balancePaid: true  });
                        else if (v === "deposit_paid") patchBooking({ depositPaid: true,  balancePaid: false });
                        else                           patchBooking({ depositPaid: false, balancePaid: false });
                      }}
                      className="input-field text-xs disabled:opacity-50 disabled:cursor-not-allowed" style={{ width: "auto", minWidth: 150, height: 30 }}>
                      <option value="unpaid">○ Unpaid</option>
                      <option value="deposit_paid">◑ Deposit Paid</option>
                      <option value="paid_full">✓ Paid in Full</option>
                    </select>
                  </div>
                )}
                {/* weather */}
                {showWeather && (booking.shootDate || booking.preferredDate) && (booking.fullAddress || booking.address) && (
                  <div className="pt-2.5">
                    <WeatherWidget
                      address={[booking.fullAddress || booking.address, booking.city, booking.state, booking.zip].filter(Boolean).join(", ")}
                      date={(booking.shootDate || booking.preferredDate).split("T")[0]}
                      lat={booking.lat || undefined} lng={booking.lng || undefined} unit={tempUnit} />
                  </div>
                )}
                {/* Additional appointments */}
                {(booking.additionalAppointments || []).length > 0 && (
                  <div className="pt-2.5 space-y-1.5">
                    {(booking.additionalAppointments || []).map((appt, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-[12px] text-gray-500">Appt {i + 2}: {appt.date ? new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD"}{appt.time ? ` · ${valToLabel(appt.time)}` : ""}</span>
                        <button type="button" onClick={() => { setReschedApptIdx(i); setReschedDate(""); setReschedTime(""); setShowReschedModal(true); }} className="text-[11px] text-[#3486cf] font-semibold">Reschedule</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* LEGACY: kept for schedule-approval flow */}
                {(booking.preferredDate || booking.preferredTime) && false && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs hidden">
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

                {/* Schedule Approval Panel */}
                {catalog?.bookingConfig?.requireScheduleApproval && booking.scheduleApprovalStatus !== "confirmed" && booking.preferredDate && (() => {
                  const reqDate = new Date(booking.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                  const reqTime = booking.preferredTime;
                  async function handleConfirm() {
                    setSchedApprovalSaving(true);
                    setSchedApprovalMsg("");
                    try {
                      const token = await auth.currentUser.getIdToken();
                      const res = await fetch(`/api/dashboard/bookings/${id}/confirm-schedule`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ action: "confirm" }),
                      });
                      if (res.ok) {
                        setBooking((b) => ({ ...b, scheduleApprovalStatus: "confirmed", shootDate: b.preferredDate, shootTime: b.preferredTime }));
                        setSchedApprovalMsg("Time confirmed. Agent notified by email.");
                      } else {
                        setSchedApprovalMsg("Failed to confirm. Please try again.");
                      }
                    } catch { setSchedApprovalMsg("Something went wrong."); }
                    setSchedApprovalSaving(false);
                  }
                  async function handlePropose() {
                    if (!schedApprovalDate || !schedApprovalTime) {
                      setSchedApprovalMsg("Enter a new date and time to propose.");
                      return;
                    }
                    setSchedApprovalSaving(true);
                    setSchedApprovalMsg("");
                    try {
                      const token = await auth.currentUser.getIdToken();
                      const res = await fetch(`/api/dashboard/bookings/${id}/confirm-schedule`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ action: "propose", shootDate: schedApprovalDate, shootTime: schedApprovalTime }),
                      });
                      if (res.ok) {
                        setBooking((b) => ({ ...b, scheduleApprovalStatus: "confirmed", shootDate: schedApprovalDate, shootTime: schedApprovalTime }));
                        setSchedApprovalMsg("New time confirmed. Agent notified by email.");
                      } else {
                        setSchedApprovalMsg("Failed to save. Please try again.");
                      }
                    } catch { setSchedApprovalMsg("Something went wrong."); }
                    setSchedApprovalSaving(false);
                  }
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-blue-800">Schedule approval required</p>
                          <p className="text-xs text-blue-600 mt-0.5">
                            Agent requested: <strong>{reqDate}{reqTime ? ` at ${reqTime}` : ""}</strong>. Confirm this time or propose a different one.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleConfirm}
                          disabled={schedApprovalSaving}
                          className="text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {schedApprovalSaving ? "Saving..." : "Confirm this time"}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">Or propose a different time</p>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={schedApprovalDate}
                            onChange={(e) => setSchedApprovalDate(e.target.value)}
                            className="input-field text-xs flex-1"
                          />
                          <input
                            type="time"
                            value={schedApprovalTime}
                            onChange={(e) => setSchedApprovalTime(e.target.value)}
                            className="input-field text-xs w-32"
                          />
                          <button
                            type="button"
                            onClick={handlePropose}
                            disabled={schedApprovalSaving}
                            className="text-xs bg-[#0F172A] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#0F172A]/80 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {schedApprovalSaving ? "Saving..." : "Send new time"}
                          </button>
                        </div>
                        {schedApprovalMsg && (
                          <p className={`text-xs font-medium ${schedApprovalMsg.includes("notified") ? "text-emerald-600" : "text-red-500"}`}>
                            {schedApprovalMsg}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Services */}
            {((booking.packageIds?.length > 0 || booking.packageId) || booking.serviceIds?.length > 0 || booking.customLineItems?.length > 0) && (
              <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
                <div className="px-[18px] py-3.5 border-b border-gray-100"><span className="text-[13.5px] font-bold text-[#0F172A]">Services Ordered</span></div>
                <div className="p-[18px]">
                {(() => {
                  const allItems = [
                    ...(catalog?.packages || []),
                    ...(catalog?.services  || []),
                    ...(catalog?.addons    || []),
                  ];
                  const nameOf = (id) => allItems.find((x) => x.id === id)?.name || id;
                  const pkgIds = booking.packageIds?.length > 0 ? booking.packageIds : (booking.packageId ? [booking.packageId] : []);
                  return (
                    <div className="space-y-1.5">
                      {pkgIds.map((pid) => (
                        <div key={pid} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Package</span>
                          <span className="text-sm font-medium text-[#0F172A]">{nameOf(pid)}</span>
                        </div>
                      ))}
                      {booking.serviceIds?.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Service</span>
                          <span className="text-sm text-[#0F172A]">{nameOf(s)}</span>
                        </div>
                      ))}
                      {booking.addonIds?.map((a) => (
                        <div key={a} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Add-on</span>
                          <span className="text-sm text-[#0F172A]">{nameOf(a)}</span>
                        </div>
                      ))}
                      {booking.customLineItems?.map((l, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Custom</span>
                            <span className="text-sm text-[#0F172A]">{l.label}</span>
                          </div>
                          <span className="text-sm font-medium text-[#3486cf]">${l.price}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>{/* close p-[18px] */}
              </div>{/* close card */}
            )}

            </div>{/* end main column */}

            {/* ── Right Rail ── */}
            <div className="space-y-4">

              {/* Deliver Readiness */}
              <div className="rounded-2xl border p-[18px]" style={{ background: "linear-gradient(160deg,#fff,#EEF4FA)", borderColor: "#DAE6F4" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{
                    background: `conic-gradient(#3486cf ${readinessPct}%,#E3EAF2 0)`,
                  }}>
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[11px] font-bold" style={{ color: "#3486cf" }}>{readinessPct}%</div>
                  </div>
                  <div>
                    <p className="font-bold text-[#0F172A]" style={{ fontSize: 14 }}>Ready to Deliver</p>
                    <p className="text-gray-500" style={{ fontSize: 11.5 }}>{readinessItems.filter((x) => x.done).length} of {readinessItems.length} checks complete</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {readinessItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5" style={{ fontSize: 12.5, color: item.done ? "#374151" : "#9CA3AF" }}>
                      <div className="w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 text-[10px]" style={{
                        background: item.done ? "#059669" : "transparent",
                        border: item.done ? "none" : "1.5px solid #D1D5DB",
                        color: "#fff",
                      }}>{item.done ? "✓" : ""}</div>
                      {item.label}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowDeliver(true)}
                  className="w-full btn-primary text-sm font-semibold py-2 rounded-xl mb-2">
                  Deliver Gallery →
                </button>
                <button onClick={() => { setDeliveryMode("later"); setShowDeliver(true); }}
                  className="w-full text-xs text-[#3486cf] font-semibold py-1.5 rounded-xl border border-[#3486cf]/20 hover:bg-[#3486cf]/5 transition-colors">
                  Schedule for later
                </button>
              </div>

              {/* Gallery Summary */}
              <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
                <div className="px-[18px] py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-[#0F172A]">Gallery</span>
                  <button onClick={() => setTab("gallery")} className="text-xs text-[#3486cf] font-semibold">View →</button>
                </div>
                <div className="p-[18px]">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { v: images.length,                                            l: "Photos" },
                      { v: videos.length,                                            l: "Videos" },
                      { v: (gallery?.floorPlans || []).length,                       l: "Floor Plans" },
                      { v: (gallery?.attachedFiles || []).length,                    l: "Docs" },
                    ].map((s) => (
                      <div key={s.l} className="rounded-[10px] p-2.5" style={{ background: "#FAFAFA" }}>
                        <p className="font-bold text-[#0F172A]" style={{ fontSize: 18 }}>{s.v}</p>
                        <p className="text-gray-500 mt-0.5" style={{ fontSize: 10.5 }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 rounded-[10px] mb-3 ${gallery?.delivered ? "bg-green-50 border border-green-200" : gallery?.unlocked ? "bg-blue-50 border border-blue-200" : "bg-amber-50 border border-amber-200"}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gallery?.delivered ? "bg-green-500" : gallery?.unlocked ? "bg-blue-500" : "bg-amber-400"}`} />
                    <span className={`text-xs font-semibold ${gallery?.delivered ? "text-green-700" : gallery?.unlocked ? "text-blue-700" : "text-amber-700"}`}>
                      {gallery?.delivered ? "Delivered to client" : gallery?.unlocked ? "Unlocked for preview" : "Ready, not yet delivered"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={openGalleryEditor}
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[#3486cf] text-white hover:bg-[#2a6dab] transition-colors">
                      Open editor
                    </button>
                    {gallery?.accessToken && tenantSlug && (
                      <button onClick={() => { navigator.clipboard.writeText(`${getAppUrl()}/${tenantSlug}/gallery/${gallery.accessToken}`); toast("Link copied."); }}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        Copy link
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              {canViewRevenue && (
                <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
                  <div className="px-[18px] py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[13.5px] font-bold text-[#0F172A]">Payment</span>
                    <button onClick={() => setTab("orders")} className="text-xs text-[#3486cf] font-semibold">Details →</button>
                  </div>
                  <div className="p-[18px]">
                    <div className="space-y-0">
                      {[
                        { k: "Total", v: formatCurrency(booking.totalPrice, currency, locale), color: "#0F172A" },
                        { k: "Deposit", v: booking.depositPaid ? `${formatCurrency(booking.depositAmount, currency, locale)} paid` : `${formatCurrency(booking.depositAmount, currency, locale)} due`, color: booking.depositPaid ? "#059669" : "#D97706" },
                        { k: "Balance", v: (booking.paidInFull || booking.balancePaid) ? "Paid" : formatCurrency(booking.remainingBalance, currency, locale), color: (booking.paidInFull || booking.balancePaid) ? "#059669" : "#D97706" },
                      ].map((row) => (
                        <div key={row.k} className="flex items-baseline justify-between py-1.5 border-b last:border-b-0" style={{ borderColor: "#F4F0E3" }}>
                          <span style={{ fontSize: 12.5, color: "#6B7280" }}>{row.k}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.v}</span>
                        </div>
                      ))}
                      {booking.tipAmount > 0 && (
                        <div className="flex items-baseline justify-between py-1.5">
                          <span style={{ fontSize: 12.5, color: "#6B7280" }}>Tip</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>+{formatCurrency(booking.tipAmount, currency, locale)}</span>
                        </div>
                      )}
                    </div>
                    {balanceDue && booking.remainingBalance > 0 && (
                      <div className="mt-3 p-2.5 rounded-[10px]" style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
                        <p className="font-bold" style={{ fontSize: 12, color: "#92400E" }}>Balance outstanding</p>
                        <p style={{ fontSize: 11, color: "#92400E", marginTop: 2 }}>Collected automatically on delivery</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>{/* end right rail */}
          </div>
        )}

        {/* ── PAYMENTS TAB ─────────────────────────────────────────── */}
        {tab === "orders" && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start", maxWidth: 900 }}>
            {/* Left col */}
            <div className="space-y-4">
            {/* Appointment Record */}
            <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
              <div className="px-[17px] py-3 border-b border-gray-100"><span className="text-[13px] font-bold text-[#0F172A]">Appointment Record</span></div>
              <div style={{ paddingTop: 2 }}>
                {[
                  { k: "Client",       v: booking.clientName },
                  { k: "Email",        v: booking.clientEmail, link: `mailto:${booking.clientEmail}` },
                  { k: "Phone",        v: booking.clientPhone },
                  { k: "Property",     v: booking.fullAddress || booking.address },
                  { k: "Shoot date",   v: booking.shootDate ? `${new Date(booking.shootDate + "T12:00:00").toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${booking.shootTime ? ` · ${valToLabel(booking.shootTime)}` : ""}` : null },
                  { k: "Photographer", v: booking.photographerName },
                  { k: "Source",       v: booking.source, muted: true },
                ].filter((r) => r.v).map((row) => (
                  <div key={row.k} className="flex justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: "#F4F0E3", fontSize: 13 }}>
                    <span style={{ color: "#6B7280" }}>{row.k}</span>
                    {row.link
                      ? <a href={row.link} style={{ color: "#3486cf", fontWeight: 600 }}>{row.v}</a>
                      : <span style={{ fontWeight: row.muted ? 400 : 600, color: row.muted ? "#9CA3AF" : "#0F172A", textAlign: "right", maxWidth: "60%" }}>{row.v}</span>}
                  </div>
                ))}
                {booking.notes && (
                  <div className="pt-2.5">
                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                    <p className="text-gray-600 italic text-sm">"{booking.notes}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Services Ordered — payments tab */}
            <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
              <div className="px-[17px] py-3 border-b border-gray-100"><span className="text-[13px] font-bold text-[#0F172A]">Services Ordered</span></div>
            {(booking.packageId || booking.serviceIds?.length > 0 || booking.customLineItems?.length > 0) && (
              <div className="px-[17px] py-3">
                {(() => {
                  const allItems = [
                    ...(catalog?.packages || []),
                    ...(catalog?.services  || []),
                    ...(catalog?.addons    || []),
                  ];
                  const nameOf = (svcId) => allItems.find((x) => x.id === svcId)?.name || svcId;
                  const pkgIds2 = booking.packageIds?.length > 0 ? booking.packageIds : (booking.packageId ? [booking.packageId] : []);
                  return (
                    <div className="space-y-2 text-sm">
                      {pkgIds2.map((pid) => (
                        <div key={pid} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Package</span>
                          <span className="font-medium text-[#0F172A]">{nameOf(pid)}</span>
                        </div>
                      ))}
                      {booking.serviceIds?.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Service</span>
                          <span className="text-[#0F172A]">{nameOf(s)}</span>
                        </div>
                      ))}
                      {booking.addonIds?.map((a) => (
                        <div key={a} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Add-on</span>
                          <span className="text-[#0F172A]">{nameOf(a)}</span>
                        </div>
                      ))}
                      {booking.customLineItems?.map((l, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Custom</span>
                            <span className="text-[#0F172A]">{l.label}</span>
                          </div>
                          <span className="text-sm font-medium text-[#3486cf]">${l.price}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            </div>{/* end services card */}
            </div>{/* end left col */}

            {/* Right col */}
            <div className="space-y-4">

              {/* Payment Summary */}
              {canViewRevenue && (
                <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
                  <div className="px-[17px] py-3 border-b border-gray-100"><span className="text-[13px] font-bold text-[#0F172A]">Payment Summary</span></div>
                  <div className="px-[17px] py-3">
                    {[
                      { k: "Total",       v: formatCurrency(booking.totalPrice, currency, locale),       bold: true },
                      { k: "Deposit",     v: booking.depositPaid ? `${formatCurrency(booking.depositAmount, currency, locale)} paid` : `${formatCurrency(booking.depositAmount, currency, locale)} — unpaid`,  color: booking.depositPaid ? "#059669" : "#D97706" },
                      { k: "Balance due", v: (booking.paidInFull || booking.balancePaid) ? "Paid" : formatCurrency(booking.remainingBalance, currency, locale), color: (booking.paidInFull || booking.balancePaid) ? "#059669" : "#D97706" },
                      ...(booking.tipAmount > 0 ? [{ k: "Tip", v: `+${formatCurrency(booking.tipAmount, currency, locale)}`, color: "#059669" }] : []),
                    ].map((r) => (
                      <div key={r.k} className="flex justify-between py-2 border-b last:border-b-0" style={{ borderColor: "#F4F0E3", fontSize: 13 }}>
                        <span style={{ color: "#6B7280" }}>{r.k}</span>
                        <span style={{ fontWeight: r.bold ? 700 : 600, color: r.color || "#0F172A" }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collect Payment */}
              {canViewRevenue && (
                <div className="bg-white border border-gray-200 rounded-[14px] overflow-hidden">
                  <div className="px-[17px] py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#0F172A]">Collect Payment</span>
                    {booking.source === "phone" && <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>Manual / phone</span>}
                  </div>
                  <div className="px-[17px] py-4 space-y-2">
                    {!booking.depositPaid && (
                      <button
                        disabled={sendingDeposit || !booking.clientEmail}
                        onClick={async () => {
                          setSendingDeposit(true); setDepositLinkMsg(""); setDepositUrl("");
                          try {
                            const token = await auth.currentUser?.getIdToken(true);
                            const res = await fetch(`/api/dashboard/bookings/${id}/send-deposit`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                            const d = await res.json();
                            if (res.ok && d.url) { setDepositUrl(d.url); setDepositLinkMsg(d.emailSent ? `Deposit request sent to ${booking.clientEmail}` : "Link generated"); }
                            else setDepositLinkMsg(d.error || "Failed.");
                          } catch { setDepositLinkMsg("Failed."); } finally { setSendingDeposit(false); }
                        }}
                        className="w-full btn-primary text-sm py-2 disabled:opacity-50">
                        {sendingDeposit ? "Sending…" : `Send 50% deposit request${booking.depositAmount ? ` · ${formatCurrency(booking.depositAmount, currency, locale)}` : ""}`}
                      </button>
                    )}
                    <button
                      disabled={sendingInvoice || !booking.clientEmail}
                      onClick={async () => {
                        setSendingInvoice(true); setInvoiceMsg("");
                        try {
                          const token = await auth.currentUser?.getIdToken(true);
                          const res = await fetch(`/api/dashboard/bookings/${id}/send-invoice`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                          if (res.ok) setInvoiceMsg(`Invoice sent to ${booking.clientEmail}`);
                          else { const d = await res.json(); setInvoiceMsg(d.error || "Failed."); }
                        } catch { setInvoiceMsg("Failed."); } finally { setSendingInvoice(false); }
                      }}
                      className="w-full text-sm py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                      {sendingInvoice ? "Sending…" : `Send full payment link${booking.totalPrice ? ` · ${formatCurrency(booking.totalPrice, currency, locale)}` : ""}`}
                    </button>
                    <div className="flex gap-2">
                      <button
                        disabled={sendingReminder || !booking.clientEmail}
                        onClick={async () => {
                          setSendingReminder(true); setReminderMsg("");
                          try {
                            const token = await auth.currentUser?.getIdToken(true);
                            const res = await fetch(`/api/dashboard/bookings/${id}/send-reminder`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                            if (res.ok) setReminderMsg(`Reminder sent to ${booking.clientEmail}`);
                            else { const d = await res.json(); setReminderMsg(d.error || "Failed."); }
                          } catch { setReminderMsg("Failed."); } finally { setSendingReminder(false); }
                        }}
                        className="flex-1 text-sm py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50" style={{ fontSize: 12 }}>
                        {sendingReminder ? "Sending…" : "Send reminder"}
                      </button>
                      {tenantSlug && (
                        <a href={`/${tenantSlug}/property/${id}/brochure`} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-center text-sm py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" style={{ fontSize: 12 }}>
                          Invoice PDF
                        </a>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                      <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wide flex-1">Or record manually</span>
                      {!booking.depositPaid && (
                        <button onClick={() => patchBooking({ depositPaid: true })} disabled={saving}
                          className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                          Mark deposit paid
                        </button>
                      )}
                      {!booking.paidInFull && !booking.balancePaid && (
                        <button onClick={() => patchBooking({ depositPaid: true, balancePaid: true })} disabled={saving}
                          className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                          Mark paid in full
                        </button>
                      )}
                    </div>
                    {(depositLinkMsg || invoiceMsg || reminderMsg) && (
                      <p className="text-xs text-green-600 mt-1">{depositLinkMsg || invoiceMsg || reminderMsg}</p>
                    )}
                    {depositUrl && (
                      <div className="p-2 bg-gray-50 rounded-lg break-all">
                        <a href={depositUrl} target="_blank" rel="noreferrer" className="text-xs text-[#3486cf] underline">{depositUrl}</a>
                      </div>
                    )}
                    {booking.stripeDepositIntentId && (
                      <p className="text-[10px] text-gray-300 mt-1 font-mono truncate">{booking.stripeDepositIntentId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Visibility */}
              {(userRole === "owner" || userRole === "admin") && (
                <div className="bg-white border border-gray-200 rounded-[14px] p-4">
                  <button disabled={hiding} onClick={async () => { setHiding(true); await patchBooking({ hidden: !booking.hidden }); setHiding(false); }}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {hiding ? "Saving…" : booking.hidden ? "Unhide booking" : "Hide booking"}
                  </button>
                  {booking.hidden && <p className="text-xs text-amber-600 mt-2">Hidden from main dashboard view.</p>}
                </div>
              )}

            </div>{/* end right col */}
          </div>
        )}

        {/* ── GALLERY TAB ──────────────────────────────────────────────────── */}
        {tab === "gallery" && (
          <div className="max-w-3xl space-y-4">
            {!gallery ? (
              <div className="card p-10 text-center">
                <p className="text-gray-400 text-sm mb-4">No gallery exists for this listing yet.</p>
                <button onClick={openGalleryEditor}
                  className="btn-primary px-5 py-2 text-sm">
                  Create Gallery
                </button>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Photos",      value: (gallery.media || []).filter((m) => !m.fileType?.startsWith("video/")).length },
                    { label: "Videos",      value: (gallery.media || []).filter((m) =>  m.fileType?.startsWith("video/")).length },
                    { label: "Floor Plans", value: (gallery.floorPlans    || []).length },
                    { label: "Documents",   value: (gallery.attachedFiles || []).length },
                  ].map((s) => (
                    <div key={s.label} className="card p-4 text-center">
                      <p className="text-2xl font-bold text-[#0F172A]">{s.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Status + Actions */}
                <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gallery.delivered ? "bg-green-500" : "bg-gray-300"}`} />
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {gallery.delivered ? "Delivered to client" : gallery.unlocked ? "Ready — not yet delivered" : "Not yet delivered"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 ml-4">
                      {gallery.unlocked ? "Client downloads enabled" : "Downloads locked until delivery"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={openGalleryEditor}
                      className="btn-primary text-sm px-4 py-2">
                      Open Editor
                    </button>
                    {tenantSlug && gallery.accessToken && (
                      <a href={`/${tenantSlug}/gallery/${gallery.accessToken}`}
                        target="_blank" rel="noopener noreferrer"
                        className="btn-outline text-sm px-4 py-2">
                        Preview →
                      </a>
                    )}
                  </div>
                </div>

                {/* Photos */}
                {(() => {
                  const photos = (gallery.media || []).filter((m) => !m.fileType?.startsWith("video/") && !m.hidden);
                  if (photos.length === 0) return null;
                  return (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Photos ({photos.length})</p>
                        <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Manage →</button>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {photos.slice(0, 18).map((m, i) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      {photos.length > 18 && (
                        <p className="text-xs text-gray-400 mt-2 text-center">+{photos.length - 18} more</p>
                      )}
                    </div>
                  );
                })()}

                {/* Inline video files */}
                {(() => {
                  const videos = (gallery.media || []).filter((m) => m.fileType?.startsWith("video/") && !m.hidden);
                  if (videos.length === 0) return null;
                  return (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Videos ({videos.length})</p>
                        <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Manage →</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {videos.map((m, i) => (
                          <div key={i} className="aspect-video rounded-lg overflow-hidden bg-gray-900">
                            <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Matterport / 3D Tour */}
                {gallery.matterportUrl && !gallery.matterportHidden && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">3D Tour</p>
                      <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Edit →</button>
                    </div>
                    <a href={gallery.matterportUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#3486cf]/30 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-[#3486cf]/10 flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F172A] group-hover:text-[#3486cf] transition-colors">View 3D Tour</p>
                        <p className="text-xs text-gray-400 truncate">{gallery.matterportUrl}</p>
                      </div>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}

                {/* Video Tour (YouTube / Vimeo URL) */}
                {gallery.videoUrl && !gallery.videoUrlHidden && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Video Tour</p>
                      <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Edit →</button>
                    </div>
                    <a href={gallery.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-red-200/50 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.817v6.366a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F172A] group-hover:text-red-600 transition-colors">Watch Video Tour</p>
                        <p className="text-xs text-gray-400 truncate">{gallery.videoUrl}</p>
                      </div>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}

                {/* Floor Plans */}
                {(() => {
                  const plans = (gallery.floorPlans || []).filter((p) => !p.hidden);
                  if (plans.length === 0) return null;
                  return (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Floor Plans ({plans.length})</p>
                        <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Manage →</button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {plans.map((p, i) => {
                          const src    = p.publicUrl || p.url;
                          const label  = p.fileName || p.name || `Floor Plan ${i + 1}`;
                          const isPdf  = p.fileType === "application/pdf" || src?.toLowerCase().endsWith(".pdf");
                          return isPdf ? (
                            <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#3486cf]/30 transition-colors group">
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-xs font-medium text-[#0F172A] group-hover:text-[#3486cf] transition-colors truncate">{label}</span>
                            </a>
                          ) : (
                            <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                              <img src={src} alt={label} className="w-full h-full object-contain" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Attached Files */}
                {(() => {
                  const files = gallery.attachedFiles || [];
                  if (files.length === 0) return null;
                  return (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Files ({files.length})</p>
                        <button onClick={openGalleryEditor} className="text-xs text-[#3486cf] hover:underline">Manage →</button>
                      </div>
                      <div className="space-y-1.5">
                        {files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-[#3486cf]/30 transition-colors group">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-xs font-medium text-[#0F172A] group-hover:text-[#3486cf] transition-colors truncate">{f.name || `File ${i + 1}`}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ── PROPERTY SITE TAB ────────────────────────────────────────────── */}
        {tab === "property" && (
          <div className="max-w-5xl space-y-4">
            {/* Publish status */}
            <div className="flex items-center justify-between card p-4">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {propSite.published ? "🟢 Website is live" : "⚫ Website is draft (not public)"}
                </p>
                {propSite.published && (
                  <a
                    href={`/${tenantSlug || ""}/property/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#3486cf] underline underline-offset-2 hover:opacity-70"
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
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${
                  propSite.published
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                {savingPropSite ? "…" : propSite.published ? "Unpublish" : "Publish"}
              </button>
            </div>

            {propSiteMsg.text && (
              <div className={`text-sm px-4 py-2.5 rounded-xl ${
                propSiteMsg.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>{propSiteMsg.text}</div>
            )}

            {/* 2-column grid for the main settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

            {/* Template + Color Scheme */}
            <div className="card">
              <h3 className="font-display text-[#3486cf] text-base mb-1">Template & Style</h3>
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
                          ? "border-[#3486cf] bg-[#3486cf]/5"
                          : "border-gray-200 hover:border-[#3486cf]/30"
                      }`}>
                      <p className={`text-sm font-semibold ${(propSite.template || "modern") === t.id ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color preset */}
              {(() => {
                const PRESETS = {
                  modern:  [{ id: "preset1", label: "Navy & Gold",        primary: "#3486cf", accent: "#c9a96e" }, { id: "preset2", label: "Charcoal & Emerald", primary: "#1a1a2e", accent: "#10b981" }],
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
                            current === p.id ? "border-[#3486cf]" : "border-gray-200 hover:border-[#3486cf]/30"
                          }`}>
                          <span className="flex gap-1">
                            <span className="w-4 h-4 rounded-full border border-white/30 shadow-sm" style={{ background: p.primary }} />
                            <span className="w-4 h-4 rounded-full border border-white/30 shadow-sm" style={{ background: p.accent }} />
                          </span>
                          <span className={current === p.id ? "font-semibold text-[#3486cf]" : "text-gray-600"}>{p.label}</span>
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setPropField("colorPreset", "custom")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                          current === "custom" ? "border-[#3486cf]" : "border-gray-200 hover:border-[#3486cf]/30"
                        }`}>
                        <span className={current === "custom" ? "font-semibold text-[#3486cf]" : "text-gray-600"}>Custom…</span>
                      </button>
                    </div>
                    {current === "custom" && (
                      <div className="flex gap-4 mt-3">
                        <div>
                          <label className="label-field text-xs">Primary Color</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={propSite.customPrimary || "#3486cf"}
                              onChange={(e) => setPropField("customPrimary", e.target.value)}
                              className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
                            <input type="text" value={propSite.customPrimary || "#3486cf"}
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
            <div className="card">
              <h3 className="font-display text-[#3486cf] text-base mb-5">Website Settings</h3>
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
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Branded website</p>
                    <p className="text-xs text-gray-400">Show your business name and logo on the listing page</p>
                  </div>
                  <button type="button"
                    onClick={() => setPropField("branded", propSite.branded === false ? true : false)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${propSite.branded !== false ? "bg-[#3486cf]" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${propSite.branded !== false ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Property details */}
            <div className="card">
              <h3 className="font-display text-[#3486cf] text-base mb-5">Property Details</h3>
              <div className="space-y-4">
                {/* Auto-fill row */}
                <div className="flex items-center gap-3 p-3 rounded-[10px]" style={{ background: "#EEF4FA", border: "1px solid #DAE6F4" }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px]" style={{ color: "#1E5A8A" }}>Auto-fill from MLS or Redfin</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#5478a0" }}>Paste a listing URL or MLS # to pull beds, baths, sqft, price, and description.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <input
                      type="text"
                      value={autofillSource}
                      onChange={(e) => setAutofillSource(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAutofill()}
                      placeholder="URL or MLS #"
                      className="input-field text-xs" style={{ width: 160 }} />
                    <button onClick={handleAutofill} disabled={autofilling || !autofillSource.trim()}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 flex-shrink-0">
                      {autofilling ? "…" : "Auto-fill"}
                    </button>
                  </div>
                </div>
                {autofillMsg && (
                  <p className={`text-xs -mt-2 ${autofillMsg.includes("coming soon") || autofillMsg.includes("manually") ? "text-amber-600" : "text-green-600"}`}>{autofillMsg}</p>
                )}
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

                {/* MLS Syndication toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">MLS Syndication Links</p>
                    <p className="text-xs text-gray-400">Show Zillow, Redfin, and Realtor.com links in the agent gallery. Disable for non-real-estate jobs.</p>
                  </div>
                  <button type="button"
                    onClick={() => setPropField("mlsSyndication", !propSite.mlsSyndication)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${propSite.mlsSyndication ? "bg-[#3486cf]" : "bg-gray-300"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${propSite.mlsSyndication ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Direct listing URLs — shown when syndication enabled */}
                {propSite.mlsSyndication && (
                  <div className="space-y-3 border border-[#3486cf]/15 rounded-xl p-4 bg-[#EEF5FC]/50">
                    <p className="text-xs font-semibold text-[#3486cf] uppercase tracking-wide">Direct Listing URLs</p>
                    <p className="text-xs text-gray-400 -mt-1">Paste the direct link to this property on each portal. If left blank, a generic address search link is used.</p>
                    {[
                      { label: "Zillow URL", field: "zillowUrl", placeholder: "https://www.zillow.com/homedetails/..." },
                      { label: "Redfin URL", field: "redfinUrl", placeholder: "https://www.redfin.com/..." },
                      { label: "Realtor.com URL", field: "realtorUrl", placeholder: "https://www.realtor.com/realestateandhomes-detail/..." },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="label-field">{label}</label>
                        <input type="url" value={propSite[field] || ""}
                          onChange={(e) => setPropField(field, e.target.value)}
                          className="input-field w-full" placeholder={placeholder} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-field !mb-0">Listing Price</label>
                      <button type="button" onClick={() => setPropField("hidden_price", !propSite.hidden_price)}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite.hidden_price ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                        {propSite.hidden_price ? "Hidden" : "Shown"}
                      </button>
                    </div>
                    <input type="text" value={propSite.price || ""}
                      onChange={(e) => setPropField("price", e.target.value)}
                      className={`input-field w-full${propSite.hidden_price ? " opacity-40" : ""}`} placeholder="$450,000" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-field !mb-0">Property Type</label>
                      <button type="button" onClick={() => setPropField("hidden_type", !propSite.hidden_type)}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite.hidden_type ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                        {propSite.hidden_type ? "Hidden" : "Shown"}
                      </button>
                    </div>
                    <select value={propSite.type || ""} onChange={(e) => setPropField("type", e.target.value)}
                      className={`input-field w-full${propSite.hidden_type ? " opacity-40" : ""}`}>
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
                  {[
                    { label: "Beds",          field: "beds",      placeholder: "4"    },
                    { label: "Baths",         field: "baths",     placeholder: "2.5"  },
                    { label: "Sq Ft",         field: "sqft",      placeholder: "2,200"},
                    { label: "Lot Acres",     field: "lotAcres",  placeholder: "0.25" },
                    { label: "Parking Spots", field: "parking",   placeholder: "2"    },
                    { label: "Year Built",    field: "yearBuilt", placeholder: "2005" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label-field !mb-0">{label}</label>
                        <button type="button" onClick={() => setPropField(`hidden_${field}`, !propSite[`hidden_${field}`])}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite[`hidden_${field}`] ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                          {propSite[`hidden_${field}`] ? "Hidden" : "Shown"}
                        </button>
                      </div>
                      <input type="text" value={propSite[field] || ""}
                        onChange={(e) => setPropField(field, e.target.value)}
                        className={`input-field w-full${propSite[`hidden_${field}`] ? " opacity-40" : ""}`}
                        placeholder={placeholder} />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-field !mb-0">Property Description</label>
                    <button type="button" onClick={() => setPropField("hidden_description", !propSite.hidden_description)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite.hidden_description ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                      {propSite.hidden_description ? "Hidden" : "Shown"}
                    </button>
                  </div>
                  <textarea
                    value={propSite.description || ""}
                    onChange={(e) => setPropField("description", e.target.value)}
                    rows={5}
                    placeholder="Describe the property — highlights, neighborhood, recent upgrades…"
                    className={`input-field w-full resize-y${propSite.hidden_description ? " opacity-40" : ""}`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-field !mb-0">Features (one per line)</label>
                    <button type="button" onClick={() => setPropField("hidden_features", !propSite.hidden_features)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite.hidden_features ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                      {propSite.hidden_features ? "Hidden" : "Shown"}
                    </button>
                  </div>
                  <textarea
                    value={(propSite.features || []).join("\n")}
                    onChange={(e) => setPropField("features", e.target.value.split("\n"))}
                    rows={4}
                    placeholder={"Hardwood floors\nGranite countertops\nAttached 2-car garage"}
                    className={`input-field w-full resize-y text-sm${propSite.hidden_features ? " opacity-40" : ""}`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-field !mb-0">Video Tour URL (YouTube / Vimeo)</label>
                    <button type="button" onClick={() => setPropField("hidden_videoUrl", !propSite.hidden_videoUrl)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${propSite.hidden_videoUrl ? "text-gray-400 bg-gray-100" : "text-[#3486cf] bg-[#3486cf]/8"}`}>
                      {propSite.hidden_videoUrl ? "Hidden" : "Shown"}
                    </button>
                  </div>
                  <input type="url" value={propSite.videoUrl || ""}
                    onChange={(e) => setPropField("videoUrl", e.target.value)}
                    className={`input-field w-full${propSite.hidden_videoUrl ? " opacity-40" : ""}`} placeholder="https://youtube.com/watch?v=..." />
                </div>
              </div>
            </div>

            {/* Agent info — up to 4 listing agents */}
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-[#3486cf] text-base">Listing Agents</h3>
                {(propSite.coAgents?.length || 0) < 3 && (
                  <button type="button"
                    onClick={() => setPropField("coAgents", [...(propSite.coAgents || []), { name: "", email: "", phone: "", brokerage: "", photo: "" }])}
                    className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2.5 py-1 rounded hover:bg-[#3486cf]/5 transition-colors">
                    + Add Agent
                  </button>
                )}
              </div>

              {/* Primary agent (agent 1 — uses existing flat fields) */}
              <div className="p-4 border border-gray-200 rounded-xl mb-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Agent 1 (Primary)</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Name</label>
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
                  <AgentImageField
                    label="Headshot"
                    value={propSite.agentPhoto || ""}
                    onChange={(url) => setPropField("agentPhoto", url)}
                    folder="agent-photos"
                    placeholder="https://..."
                    preview="circle"
                  />
                  <AgentImageField
                    label="Brokerage Logo"
                    value={propSite.agentLogoUrl || ""}
                    onChange={(url) => setPropField("agentLogoUrl", url)}
                    folder="agent-logos"
                    placeholder="https://... or upload"
                    hint="Shown on the property website next to the agent card."
                    preview="rect"
                  />
                </div>
              </div>

              {/* Co-agents (agents 2–4) */}
              {(propSite.coAgents || []).map((agent, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-xl mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Agent {i + 2}</p>
                    <button type="button"
                      onClick={() => setPropField("coAgents", (propSite.coAgents || []).filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-field">Name</label>
                        <input type="text" value={agent.name || ""}
                          onChange={(e) => {
                            const arr = [...(propSite.coAgents || [])];
                            arr[i] = { ...arr[i], name: e.target.value };
                            setPropField("coAgents", arr);
                          }}
                          className="input-field w-full" placeholder="Agent name" />
                      </div>
                      <div>
                        <label className="label-field">Brokerage</label>
                        <input type="text" value={agent.brokerage || ""}
                          onChange={(e) => {
                            const arr = [...(propSite.coAgents || [])];
                            arr[i] = { ...arr[i], brokerage: e.target.value };
                            setPropField("coAgents", arr);
                          }}
                          className="input-field w-full" placeholder="RE/MAX" />
                      </div>
                      <div>
                        <label className="label-field">Phone</label>
                        <input type="tel" value={agent.phone || ""}
                          onChange={(e) => {
                            const arr = [...(propSite.coAgents || [])];
                            arr[i] = { ...arr[i], phone: e.target.value };
                            setPropField("coAgents", arr);
                          }}
                          className="input-field w-full" />
                      </div>
                      <div>
                        <label className="label-field">Email</label>
                        <input type="email" value={agent.email || ""}
                          onChange={(e) => {
                            const arr = [...(propSite.coAgents || [])];
                            arr[i] = { ...arr[i], email: e.target.value };
                            setPropField("coAgents", arr);
                          }}
                          className="input-field w-full" />
                      </div>
                    </div>
                    <AgentImageField
                      label="Headshot"
                      value={agent.photo || ""}
                      onChange={(url) => {
                        const arr = [...(propSite.coAgents || [])];
                        arr[i] = { ...arr[i], photo: url };
                        setPropField("coAgents", arr);
                      }}
                      folder="agent-photos"
                      placeholder="https://..."
                      preview="circle"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Agent Custom Domain (per-listing) */}
            <div className="card">
              <h3 className="font-display text-[#3486cf] text-base mb-1">Agent Custom Domain</h3>
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

            </div>{/* end 2-col grid */}

            <div className="flex items-center gap-4">
              <button onClick={savePropSite} disabled={savingPropSite} className="btn-primary px-8 py-3">
                {savingPropSite ? "Saving…" : "Save Property Website"}
              </button>
              {propSite.published && (
                <a
                  href={`/${tenantSlug || ""}/property/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#3486cf] underline underline-offset-2 hover:opacity-70"
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
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Listing URL</p>
                <div className="flex gap-2 items-center">
                  <input readOnly value={listingUrl}
                    className="flex-1 input-field text-sm bg-gray-50 text-gray-600" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(listingUrl); }}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-[#3486cf] text-white hover:bg-[#3486cf]/90 transition-colors flex-shrink-0">
                    Copy
                  </button>
                  <a href={listingUrl} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
                    ↗ Open
                  </a>
                </div>
                {!propSite.published && (
                  <p className="text-xs text-amber-600 mt-2">Publish the property website first to get a shareable URL.</p>
                )}
              </div>
            )}

            {/* Analytics */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Listing Analytics</p>
                <button onClick={loadAnalytics} disabled={analyticsLoading}
                  className="text-xs text-[#3486cf] hover:underline disabled:opacity-50">
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
                    <p className="text-3xl font-bold text-[#3486cf]">{analytics?.views ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Page Views</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-[#3486cf]">{analytics?.inquiries?.length ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Inquiries</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-3xl font-bold text-[#3486cf]">
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
                <div className="card p-5">
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
                        className="inline-block text-xs font-medium text-[#3486cf] hover:underline">
                        ↓ Download high-res QR
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Brochure */}
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">Print Brochure</p>
                <p className="text-sm text-gray-600 mb-4 leading-snug">One-page property brochure with photos, stats, agent info, and QR code. Ready to print or save as PDF.</p>
                {tenantSlug ? (
                  <a
                    href={`/${tenantSlug}/property/${id}/brochure`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#3486cf] text-white hover:bg-[#3486cf]/90 transition-colors">
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

{/* Inquiries */}
            {analytics?.inquiries?.length > 0 && (
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-4">
                  Inquiries ({analytics.inquiries.length})
                </p>
                <div className="divide-y divide-gray-100">
                  {analytics.inquiries.map((inq) => (
                    <div key={inq.id} className="py-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="font-medium text-[#0F172A]">{inq.name}</p>
                        <a href={`mailto:${inq.email}`} className="text-xs text-[#3486cf] hover:underline">{inq.email}</a>
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
              <div className="text-center py-6 text-sm text-gray-400 card">
                No inquiries yet. Share the listing URL to start getting leads.
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ─────────────────────────────────────────────────── */}
        {tab === "activity" && (
          <div className="max-w-2xl space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Gallery Activity Log</p>
                <button onClick={() => loadActivity(gallery?.id)}
                  className="text-xs text-[#3486cf] hover:underline">Refresh</button>
              </div>

              {activityLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
                </div>
              ) : !gallery ? (
                <p className="text-sm text-gray-400 text-center py-6">No gallery attached to this listing yet.</p>
              ) : activityLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activity recorded yet. Activity appears here once the gallery is delivered and accessed.</p>
              ) : (
                <div className="space-y-0 divide-y divide-gray-50">
                  {activityLog.map((ev) => {
                    const icons = {
                      view:     { icon: "👁", label: "Gallery viewed", color: "text-blue-600 bg-blue-50" },
                      download: { icon: "⬇", label: "File downloaded", color: "text-green-600 bg-green-50" },
                      link_copy:{ icon: "🔗", label: "Gallery link copied", color: "text-purple-600 bg-purple-50" },
                      note:     { icon: "📝", label: "Admin note", color: "text-gray-600 bg-gray-50" },
                    };
                    const meta = icons[ev.event] || { icon: "·", label: ev.event, color: "text-gray-500 bg-gray-50" };
                    return (
                      <div key={ev.id} className="flex items-start gap-3 py-3">
                        <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${meta.color}`}>
                          {meta.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0F172A]">{meta.label}</p>
                          {ev.email && <p className="text-xs text-gray-500">{ev.email}</p>}
                          {ev.fileName && <p className="text-xs text-gray-500 truncate">{ev.fileName}</p>}
                          {ev.note && <p className="text-xs text-gray-500 italic">{ev.note}</p>}
                        </div>
                        <p className="text-xs text-gray-400 flex-shrink-0">
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── REVISIONS TAB ────────────────────────────────────────────────── */}
        {tab === "revisions" && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-gray-400">Agent revision requests for this listing.</p>
              </div>
              <div className="flex gap-1">
                {[["all","All"],["pending","Pending"],["acknowledged","In Progress"],["resolved","Resolved"]].map(([val, label]) => (
                  <button key={val} onClick={() => { setRevFilter(val); setRevisions(null); loadRevisions(); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      revFilter === val ? "bg-[#3486cf] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {revisionsLoading || revisions === null ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
              </div>
            ) : (() => {
              const filtered = revisions.filter((r) => revFilter === "all" || r.status === revFilter);
              return filtered.length === 0 ? (
                <div className="card p-10 text-center">
                  <p className="text-sm font-medium text-gray-500">No revision requests</p>
                  <p className="text-xs text-gray-400 mt-1">Agent revision requests for this listing will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((r) => {
                    const STATUS_CLS = {
                      pending:      "bg-amber-100 text-amber-700",
                      acknowledged: "bg-blue-100 text-blue-700",
                      resolved:     "bg-emerald-100 text-emerald-700",
                    };
                    const statusCls = STATUS_CLS[r.status] || "bg-gray-100 text-gray-600";
                    const isOpen = revExpanded === r.id;
                    return (
                      <div key={r.id} className="card overflow-hidden">
                        <button
                          onClick={() => setRevExpanded(isOpen ? null : r.id)}
                          className="w-full flex items-start gap-3 p-5 text-left hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>
                                {r.status === "acknowledged" ? "In Progress" : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {r.requestedAt ? new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <p className="font-semibold text-gray-900 text-sm">{r.agentName || r.agentEmail}</p>
                            <p className="text-xs text-gray-400">{r.agentEmail}</p>
                            <p className="text-sm text-gray-700 mt-1.5 line-clamp-2">{r.message}</p>
                          </div>
                          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Request</p>
                              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{r.message}</p>
                            </div>
                            {r.mediaItems?.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Flagged Media ({r.mediaItems.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {r.mediaItems.map((m, i) => (
                                    <a key={i} href={m.url || m} target="_blank" rel="noopener noreferrer"
                                      className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-[#3486cf] hover:bg-gray-50 transition-colors">
                                      Media {i + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Notes (internal)</p>
                              <textarea rows={2}
                                value={revNotes[r.id] ?? r.adminNotes ?? ""}
                                onChange={(e) => setRevNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 resize-none"
                                placeholder="Internal notes (not visible to agent)…" />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {r.status === "pending" && (
                                <button onClick={() => updateRevisionStatus(r.id, "acknowledged")} disabled={revSaving === r.id}
                                  className="text-sm font-medium px-4 py-2 rounded-lg border border-[#3486cf] text-[#3486cf] hover:bg-[#EEF5FC] transition-colors disabled:opacity-50">
                                  {revSaving === r.id ? "Saving…" : "Acknowledge"}
                                </button>
                              )}
                              {r.status !== "resolved" && (
                                <button onClick={() => updateRevisionStatus(r.id, "resolved")} disabled={revSaving === r.id}
                                  className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                  {revSaving === r.id ? "Saving…" : "Mark Resolved"}
                                </button>
                              )}
                              {r.status === "resolved" && r.resolvedAt && (
                                <p className="text-xs text-gray-400 self-center">
                                  Resolved {new Date(r.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>{/* end main px-7 content area */}

      {/* Deliver modal */}
      {showDeliver && (
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={() => setShowDeliver(false)} />
          <div className="modal-card relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="font-semibold text-[#0F172A] text-base">Deliver Gallery</h2>
              <button onClick={() => setShowDeliver(false)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
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
                        deliveryMode === val ? "bg-[#3486cf] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
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
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
                  <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Preview</p>
                  <p>Hi {booking.clientName?.split(" ")[0] || "there"},</p>
                  {emailNote && <p className="italic text-gray-500">{emailNote}</p>}
                  <p>Your media for <strong>{address}</strong> is ready to view and download.</p>
                  <p className="text-[#3486cf] underline text-xs">[ View Gallery → ]</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-2">
              <div className="flex gap-2.5 px-3.5 py-3 rounded-[10px]" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <span className="font-bold flex-shrink-0" style={{ color: "#1D4ED8" }}>ⓘ</span>
                <p className="text-xs leading-relaxed" style={{ color: "#1D4ED8", margin: 0 }}>
                  Delivering unlocks downloads and emails the client.
                  {balanceDue && booking.remainingBalance > 0 && ` Outstanding balance of ${formatCurrency(booking.remainingBalance, currency, locale)} will be requested at the same time.`}
                </p>
              </div>
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
      </div>
      )}

      {showReschedModal && (() => {
        const isAdditional = reschedApptIdx !== null;
        const cancCfg = catalog?.bookingConfig?.cancellation;
        const reschedEnabled  = cancCfg?.rescheduleEnabled;
        const reschedPct      = cancCfg?.reschedulePercent    || 0;
        const reschedWindowHrs = cancCfg?.rescheduleWindowHrs || 0;
        const currentShootDate = booking.shootDate?.split?.("T")?.[0];
        let fee = 0;
        if (!isAdditional && reschedEnabled && reschedPct > 0 && reschedWindowHrs > 0 && currentShootDate) {
          const shootDt    = new Date(`${currentShootDate}T${booking.shootTime || "12:00:00"}`);
          const hoursUntil = (shootDt - new Date()) / (1000 * 60 * 60);
          if (hoursUntil >= 0 && hoursUntil <= reschedWindowHrs) {
            fee = Math.round((booking.totalPrice || 0) * reschedPct) / 100;
          }
        }
        const currentAppt = isAdditional ? (booking.additionalAppointments || [])[reschedApptIdx] : null;
        const currentLabel = isAdditional
          ? (currentAppt?.date ? new Date(currentAppt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBD") + (currentAppt?.time ? ` · ${valToLabel(currentAppt.time)}` : "")
          : `${shootDateDisplay}${booking.shootTime ? ` · ${valToLabel(booking.shootTime)}` : ""}`;
        const newDateLabel = reschedDate
          ? `${new Date(reschedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${reschedTime ? ` · ${valToLabel(reschedTime)}` : ""}`
          : null;
        return (
          <>
            <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => { setShowReschedModal(false); setShowReschedDtPicker(false); }}>
              <div className="modal-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-[#0F172A]">
                    {isAdditional ? `Reschedule Appointment ${reschedApptIdx + 2}` : "Reschedule Appointment"}
                  </h3>
                  <button type="button" onClick={() => setShowReschedModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>
                <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Current Date & Time</p>
                  <p className="text-sm font-medium text-[#0F172A]">{currentLabel}</p>
                </div>
                <button type="button" onClick={() => setShowReschedDtPicker(true)}
                  className="input-field w-full text-left flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span className={newDateLabel ? "text-[#0F172A] text-sm" : "text-gray-400 text-sm"}>
                    {newDateLabel || "Pick new date & time"}
                  </span>
                </button>
                {fee > 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Reschedule Fee</p>
                    <p className="text-xl font-bold text-amber-700">{formatCurrency(fee, currency, locale)}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">{reschedPct}% of booking total — within {reschedWindowHrs}hr window</p>
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => setShowReschedModal(false)}
                    className="btn-outline flex-1 py-2 text-sm">Cancel</button>
                  <button type="button"
                    disabled={!reschedDate || saving}
                    onClick={async () => {
                      if (isAdditional) {
                        const updated = (booking.additionalAppointments || []).map((a, i) =>
                          i === reschedApptIdx ? { ...a, date: reschedDate, time: reschedTime } : a
                        );
                        await patchBooking({ additionalAppointments: updated });
                      } else {
                        const fields = { shootDate: reschedDate, shootTime: reschedTime };
                        if (fee > 0) fields.rescheduleFee = fee;
                        await patchBooking(fields);
                      }
                      setShowReschedModal(false);
                    }}
                    className="btn-primary flex-1 py-2 text-sm">
                    {saving ? "Saving…" : "Confirm Reschedule"}
                  </button>
                </div>
              </div>
            </div>
            {showReschedDtPicker && (
              <DateTimePicker
                date={reschedDate}
                time={reschedTime}
                onConfirm={(d, t) => { setReschedDate(d); setReschedTime(t); setShowReschedDtPicker(false); }}
                onClose={() => setShowReschedDtPicker(false)}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
