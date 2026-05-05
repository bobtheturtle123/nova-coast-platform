"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStepper from "@/components/booking/WorkflowStepper";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus, WORKFLOW_STATUSES } from "@/lib/workflowStatus";

const WORKFLOW_STATUS_MAP = Object.fromEntries(WORKFLOW_STATUSES.map((s) => [s.id, s]));

function WeatherWidget({ booking, tempUnit = "F" }) {
  const [wx,      setWx]      = useState(null);
  const [loading, setLoading] = useState(false);

  // Use confirmed shootDate, fall back to preferredDate
  const weatherDate = (booking.shootDate || booking.preferredDate)?.split?.("T")?.[0];

  useEffect(() => {
    const address = booking.fullAddress || booking.address;
    const date    = weatherDate;
    if (!address || !date) return;
    setLoading(true);
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch(
        `/api/dashboard/weather?address=${encodeURIComponent(address)}&date=${date}&unit=${tempUnit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setWx(data);
      setLoading(false);
    });
  }, [booking.fullAddress, booking.address, weatherDate, tempUnit]);

  if (!weatherDate) return null;
  if (loading) return (
    <div className="card mb-6">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Weather Forecast</h3>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
        Loading forecast…
      </div>
    </div>
  );
  if (!wx) return null;

  if (!wx.available) {
    const msg = wx.reason === "too_far"
      ? `Forecast unavailable — shoot is ${wx.daysOut} days out (max 16 days)`
      : wx.reason === "past"
      ? "Shoot date has passed"
      : "Forecast unavailable for this location";
    return (
      <div className="card mb-6">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Weather Forecast</h3>
        <p className="text-sm text-gray-400">{msg}</p>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-3">
        Weather Forecast
        <span className="ml-2 font-normal normal-case text-gray-300">
          {wx.daysOut === 0 ? "Today" : wx.daysOut === 1 ? "Tomorrow" : `${wx.daysOut} days out`}
        </span>
      </h3>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-4xl">{wx.icon}</span>
        <div>
          <p className="text-2xl font-semibold text-[#0F172A]">{wx.temp}°{wx.tempUnit || "F"}</p>
          <p className="text-sm text-gray-500">{wx.description} · H:{wx.tempHigh}° L:{wx.tempLow}°</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded p-2.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">UV Index</p>
          <p className={`font-semibold ${wx.uvLabel?.color || "text-[#0F172A]"}`}>{wx.uvIndex}</p>
          <p className={`text-xs ${wx.uvLabel?.color || "text-gray-400"}`}>{wx.uvLabel?.label}</p>
        </div>
        {wx.aqi !== null && (
          <div className="bg-gray-50 rounded p-2.5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Air Quality</p>
            <p className={`font-semibold ${wx.aqiLabel?.color || "text-[#0F172A]"}`}>{wx.aqi}</p>
            <p className={`text-xs ${wx.aqiLabel?.color || "text-gray-400"}`}>{wx.aqiLabel?.label}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded p-2.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Wind</p>
          <p className="font-semibold text-[#0F172A]">{wx.windSpeed} {wx.tempUnit === "C" ? "km/h" : "mph"}</p>
          {wx.precipitation > 0 && (
            <p className="text-xs text-blue-500">{wx.precipitation}{wx.tempUnit === "C" ? "mm" : "\""} precip</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SignedAgreementPanel({ booking }) {
  const [expanded, setExpanded] = useState(false);

  const signedAt = booking.contractSignedAt
    ? new Date(booking.contractSignedAt._seconds
        ? booking.contractSignedAt._seconds * 1000
        : booking.contractSignedAt
      ).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="bg-white rounded-xl border border-green-200 p-5 mb-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wide text-gray-400">Signed Service Agreement</h3>
        <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">Executed</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Client Signature</p>
          <p className="font-medium text-[#0F172A] italic">{booking.contractSignerName}</p>
          {signedAt && <p className="text-xs text-gray-400 mt-0.5">{signedAt}</p>}
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Counter-signed by</p>
          <p className="font-medium text-[#0F172A]">{booking.contractCounterSignedBy}</p>
          <p className="text-xs text-gray-400 mt-0.5">Auto-confirmed</p>
        </div>
      </div>
      {booking.contractText && (
        <div>
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#3486cf] hover:underline mb-2">
            {expanded ? "Hide agreement text ▲" : "View agreement text ▼"}
          </button>
          {expanded && (
            <pre className="text-xs text-gray-600 font-mono leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-3 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {booking.contractText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [booking,         setBooking]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [msg,             setMsg]             = useState("");
  const [convertingToListing, setConvertingToListing] = useState(false);
  const [shootDate, setShootDate] = useState("");
  const [showWeather, setShowWeather] = useState(true);
  const [tempUnit,    setTempUnit]    = useState("F");

  const [workflowStatus,   setWorkflowStatus]  = useState("booked");
  const [statusHistory,    setStatusHistory]   = useState([]);
  const [updatingWorkflow, setUpdatingWorkflow] = useState(false);
  const [pendingRevCount,  setPendingRevCount] = useState(0);

  // Edit mode state
  const [editingClient,  setEditingClient]  = useState(false);
  const [editClient,     setEditClient]     = useState({ clientName: "", clientEmail: "", clientPhone: "" });
  const [editingAddress, setEditingAddress] = useState(false);
  const [editAddress,    setEditAddress]    = useState({ address: "", city: "", state: "", zip: "" });
  const [editingPayment, setEditingPayment] = useState(false);
  const [editPayment,    setEditPayment]    = useState({
    depositPaid: false, depositAmount: 0,
    balancePaid: false, remainingBalance: 0,
    offlinePaymentAmount: "", offlinePaymentMethod: "", offlinePaymentNote: "",
  });

  // Job costs state
  const [costs, setCosts] = useState({ shooterFee: 0, editorFee: 0, travelCost: 0, otherCosts: 0, shootHours: "", editHoursPerPhoto: "", notes: "" });
  const [costsSaving, setCostsSaving] = useState(false);
  const [costsMsg,    setCostsMsg]    = useState("");
  const [globalCostRates, setGlobalCostRates] = useState(null);

  // Photographer assignment
  const [teamMembers,      setTeamMembers]      = useState([]);
  const [editingPhotog,    setEditingPhotog]    = useState(false);
  const [editPhotog,       setEditPhotog]       = useState({ photographerId: "", photographerName: "", photographerEmail: "", photographerPhone: "" });

  // Activity log
  const [activity,         setActivity]         = useState([]);
  const [activityLoaded,   setActivityLoaded]   = useState(false);
  const [noteText,         setNoteText]         = useState("");
  const [postingNote,      setPostingNote]      = useState(false);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [bookingRes, tenantRes, revisionsRes, teamRes, activityRes] = await Promise.all([
        fetch(`/api/dashboard/bookings/${id}`,                                    { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",                                             { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/dashboard/revisions?bookingId=${id}&status=pending`,           { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",                                               { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/dashboard/bookings/${id}/activity`,                            { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [bookingData, tenantData, revisionsData, teamData, activityData] = await Promise.all([
        bookingRes.ok    ? bookingRes.json()    : null,
        tenantRes.ok     ? tenantRes.json()     : null,
        revisionsRes.ok  ? revisionsRes.json()  : null,
        teamRes.ok       ? teamRes.json()       : null,
        activityRes.ok   ? activityRes.json()   : null,
      ]);
      if (revisionsData?.revisions) setPendingRevCount(revisionsData.revisions.length);

      if (bookingData) {
        const bk = bookingData.booking;
        setBooking(bk);
        setShootDate(bk.shootDate?.split?.("T")?.[0] || "");
        setWorkflowStatus(resolveWorkflowStatus(bk));
        setStatusHistory(bk.statusHistory || []);
        setEditClient({ clientName: bk.clientName || "", clientEmail: bk.clientEmail || "", clientPhone: bk.clientPhone || "" });
        setEditAddress({ address: bk.addressLine || bk.address || "", city: bk.city || "", state: bk.state || "", zip: bk.zip || "" });
        setEditPayment({
          depositPaid: !!bk.depositPaid, depositAmount: bk.depositAmount || 0,
          balancePaid: !!bk.balancePaid, remainingBalance: bk.remainingBalance || 0,
          offlinePaymentAmount: bk.offlinePaymentAmount || "",
          offlinePaymentMethod: bk.offlinePaymentMethod || "",
          offlinePaymentNote:   bk.offlinePaymentNote   || "",
        });
        setEditPhotog({
          photographerId:    bk.photographerId    || "",
          photographerName:  bk.photographerName  || "",
          photographerEmail: bk.photographerEmail || "",
          photographerPhone: bk.photographerPhone || "",
        });
        if (bk.costs) {
          setCosts({
            shooterFee:        bk.costs.shooterFee        || 0,
            editorFee:         bk.costs.editorFee         || 0,
            travelCost:        bk.costs.travelCost        || 0,
            otherCosts:        bk.costs.otherCosts        || 0,
            shootHours:        bk.costs.shootHours        ?? "",
            editHoursPerPhoto: bk.costs.editHoursPerPhoto ?? "",
            notes:             bk.costs.notes             || "",
          });
        } else if (tenantData?.tenant?.costRates) {
          // No costs saved yet — seed from global rates + product pay rate
          const cr = tenantData.tenant.costRates;
          const suggestedPay = bk.suggestedShooterPay;
          setCosts((prev) => ({
            ...prev,
            shooterFee: suggestedPay != null ? suggestedPay : prev.shooterFee,
            otherCosts: cr.otherFlat || 0,
          }));
        }
      }
      if (tenantData) {
        const av = tenantData.tenant?.bookingConfig?.availability;
        if (av?.showWeather !== undefined) setShowWeather(av.showWeather);
        if (tenantData.tenant?.costRates) setGlobalCostRates(tenantData.tenant.costRates);
        if (tenantData.tenant?.tempUnit)  setTempUnit(tenantData.tenant.tempUnit);
      }
      if (teamData?.members) {
        setTeamMembers(teamData.members.filter((m) => m.active !== false));
      }
      if (activityData?.activity) {
        setActivity(activityData.activity);
        setActivityLoaded(true);
      }
      setLoading(false);
    });
  }, [id]);

  async function update(fields) {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking((b) => ({ ...b, ...fields }));
        setMsg("Saved successfully.");
      } else {
        setMsg(data.error || "Failed to save.");
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function updateWorkflowStatus(newStatus) {
    setUpdatingWorkflow(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/workflow-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflowStatus: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setWorkflowStatus(newStatus);
        setStatusHistory((prev) => [
          ...prev,
          { status: newStatus, changedAt: new Date().toISOString(), changedBy: "admin" },
        ]);
        setMsg("Workflow status updated.");
      } else {
        setMsg(data.error || "Failed to update status.");
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setUpdatingWorkflow(false);
    }
  }

  async function sendConfirmation() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`/api/dashboard/bookings/${id}/send-confirmation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Confirmation email sent.");
    } catch {
      setMsg("Failed to send email.");
    } finally {
      setSaving(false);
    }
  }

  async function sendDepositRequest() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/send-deposit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Copy link to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.url);
          setMsg(`Deposit link copied to clipboard! Send it to ${booking.clientEmail || "the client"}.`);
        } else {
          setMsg(`Deposit link: ${data.url}`);
        }
        setBooking((b) => ({ ...b, depositCheckoutUrl: data.url }));
      } else {
        setMsg(data.error || "Failed to create deposit link.");
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCosts() {
    setCostsSaving(true);
    setCostsMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shooterFee:        Number(costs.shooterFee)        || 0,
          editorFee:         Number(costs.editorFee)         || 0,
          travelCost:        Number(costs.travelCost)        || 0,
          otherCosts:        Number(costs.otherCosts)        || 0,
          shootHours:        costs.shootHours        !== "" ? Number(costs.shootHours)        : undefined,
          editHoursPerPhoto: costs.editHoursPerPhoto !== "" ? Number(costs.editHoursPerPhoto) : undefined,
          notes:             costs.notes || "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking((b) => ({ ...b, costs: data.costs }));
        setCostsMsg("Costs saved.");
      } else {
        setCostsMsg(data.error || "Failed to save costs.");
      }
    } catch {
      setCostsMsg("Something went wrong.");
    } finally {
      setCostsSaving(false);
    }
  }

  async function postNote() {
    if (!noteText.trim()) return;
    setPostingNote(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: noteText }),
      });
      if (res.ok) {
        const data = await res.json();
        setActivity((prev) => [{ type: "note", note: data.note.text, changedAt: data.note.createdAt }, ...prev]);
        setNoteText("");
      }
    } catch { /* ignore */ }
    setPostingNote(false);
  }

  async function createGallery() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/gallery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Gallery created.");
        router.push(`/dashboard/galleries/${data.galleryId}`);
      } else {
        setMsg(data.error || "Failed to create gallery.");
      }
    } catch {
      setMsg("Failed to create gallery.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" /></div>
  );

  if (!booking) return (
    <div className="p-8">
      <p className="text-gray-500">Booking not found.</p>
      <Link href="/dashboard/bookings" className="text-[#3486cf] text-sm hover:underline mt-2 block">← Back to bookings</Link>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/bookings" className="text-sm text-gray-400 hover:text-[#3486cf] flex items-center gap-1 mb-6">
        ← Back to bookings
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{booking.clientName}</h1>
          <p className="text-gray-400 text-sm">{booking.fullAddress}</p>
          {(booking.shootDate || booking.preferredDate) && (
            <p className="text-gray-400 text-sm mt-0.5">
              {new Date((booking.shootDate || booking.preferredDate).split("T")[0] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
        <WorkflowStatusBadge status={workflowStatus} />
      </div>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-xl mb-4">
          {msg}
        </div>
      )}

      {pendingRevCount > 0 && (
        <Link href="/dashboard/revisions"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 hover:bg-amber-100 transition-colors">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
            {pendingRevCount}
          </span>
          <span className="text-sm text-amber-800 font-medium">
            {pendingRevCount === 1 ? "1 pending revision request" : `${pendingRevCount} pending revision requests`} — review in Revisions inbox
          </span>
          <span className="ml-auto text-amber-500 text-sm">→</span>
        </Link>
      )}

      <WorkflowStepper
        currentStatus={workflowStatus}
        onStatusChange={updateWorkflowStatus}
        history={statusHistory}
        updating={updatingWorkflow}
      />

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Client info */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-gray-400">Client</h3>
            <button onClick={() => setEditingClient((v) => !v)} className="text-xs text-[#3486cf] hover:underline">
              {editingClient ? "Cancel" : "Edit"}
            </button>
          </div>
          {editingClient ? (
            <div className="space-y-2">
              <input value={editClient.clientName} onChange={(e) => setEditClient((c) => ({ ...c, clientName: e.target.value }))}
                className="input-field text-sm w-full" placeholder="Name" />
              <input value={editClient.clientEmail} onChange={(e) => setEditClient((c) => ({ ...c, clientEmail: e.target.value }))}
                className="input-field text-sm w-full" placeholder="Email" />
              <input value={editClient.clientPhone} onChange={(e) => setEditClient((c) => ({ ...c, clientPhone: e.target.value }))}
                className="input-field text-sm w-full" placeholder="Phone" />
              <button onClick={async () => { await update(editClient); setEditingClient(false); }} disabled={saving}
                className="btn-primary text-xs px-3 py-1.5">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">{booking.clientName}</p>
              <p className="text-sm text-gray-500">{booking.clientEmail}</p>
              <p className="text-sm text-gray-500">{booking.clientPhone}</p>
            </>
          )}
        </div>

        {/* Address */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wide text-gray-400">Property</h3>
            <button onClick={() => setEditingAddress((v) => !v)} className="text-xs text-[#3486cf] hover:underline">
              {editingAddress ? "Cancel" : "Edit"}
            </button>
          </div>
          {editingAddress ? (
            <div className="space-y-2">
              <input value={editAddress.address} onChange={(e) => setEditAddress((a) => ({ ...a, address: e.target.value }))}
                className="input-field text-sm w-full" placeholder="Street address" />
              <div className="grid grid-cols-3 gap-2">
                <input value={editAddress.city} onChange={(e) => setEditAddress((a) => ({ ...a, city: e.target.value }))}
                  className="input-field text-sm col-span-1" placeholder="City" />
                <input value={editAddress.state} onChange={(e) => setEditAddress((a) => ({ ...a, state: e.target.value }))}
                  className="input-field text-sm col-span-1" placeholder="State" />
                <input value={editAddress.zip} onChange={(e) => setEditAddress((a) => ({ ...a, zip: e.target.value }))}
                  className="input-field text-sm col-span-1" placeholder="ZIP" />
              </div>
              <button onClick={async () => {
                const fullAddress = [editAddress.address, editAddress.city, editAddress.state, editAddress.zip].filter(Boolean).join(", ");
                await update({ ...editAddress, addressLine: editAddress.address, fullAddress });
                setEditingAddress(false);
              }} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-700">{booking.fullAddress || booking.address}</p>
          )}
        </div>
      </div>

      {/* Photographer assignment */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Photographer</h3>
          <button onClick={() => setEditingPhotog((v) => !v)} className="text-xs text-[#3486cf] hover:underline">
            {editingPhotog ? "Cancel" : "Assign"}
          </button>
        </div>
        {editingPhotog ? (
          <div className="space-y-3">
            {teamMembers.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select from team</label>
                <select
                  value={editPhotog.photographerId}
                  onChange={(e) => {
                    const m = teamMembers.find((t) => t.id === e.target.value);
                    if (m) setEditPhotog({ photographerId: m.id, photographerName: m.name, photographerEmail: m.email || "", photographerPhone: m.phone || "" });
                    else   setEditPhotog((p) => ({ ...p, photographerId: "" }));
                  }}
                  className="input-field text-sm w-full"
                >
                  <option value="">— Pick a team member —</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input value={editPhotog.photographerName}
                onChange={(e) => setEditPhotog((p) => ({ ...p, photographerName: e.target.value }))}
                className="input-field text-sm" placeholder="Name" />
              <input value={editPhotog.photographerPhone}
                onChange={(e) => setEditPhotog((p) => ({ ...p, photographerPhone: e.target.value }))}
                className="input-field text-sm" placeholder="Phone" />
            </div>
            <input value={editPhotog.photographerEmail}
              onChange={(e) => setEditPhotog((p) => ({ ...p, photographerEmail: e.target.value }))}
              className="input-field text-sm w-full" placeholder="Email" />
            <button onClick={async () => {
              await update({ ...editPhotog, workflowStatus: editPhotog.photographerId ? "photographer_assigned" : workflowStatus });
              if (editPhotog.photographerId) {
                setWorkflowStatus("photographer_assigned");
                setStatusHistory((prev) => [...prev, { status: "photographer_assigned", changedAt: new Date().toISOString(), changedBy: "admin" }]);
              }
              setEditingPhotog(false);
            }} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
              {saving ? "Saving…" : "Save Assignment"}
            </button>
          </div>
        ) : (
          booking.photographerName ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{booking.photographerName}</p>
              {booking.photographerPhone && <p className="text-sm text-gray-500">{booking.photographerPhone}</p>}
              {booking.photographerEmail && <p className="text-sm text-gray-500">{booking.photographerEmail}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No photographer assigned yet.</p>
          )
        )}
      </div>

      {/* Pricing & Payment override */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Payment</h3>
          <button onClick={() => setEditingPayment((v) => !v)} className="text-xs text-[#3486cf] hover:underline">
            {editingPayment ? "Cancel" : "Edit / Override"}
          </button>
        </div>
        {editingPayment ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total Price ($)</label>
                <input type="number" min="0" step="0.01"
                  value={booking.totalPrice || 0}
                  onChange={(e) => setBooking((b) => ({ ...b, totalPrice: Number(e.target.value) }))}
                  className="input-field text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deposit Amount ($)</label>
                <input type="number" min="0" step="0.01"
                  value={editPayment.depositAmount}
                  onChange={(e) => setEditPayment((p) => ({ ...p, depositAmount: Number(e.target.value) }))}
                  className="input-field text-sm w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editPayment.depositPaid}
                  onChange={(e) => setEditPayment((p) => ({ ...p, depositPaid: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm text-gray-700">Deposit paid</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editPayment.balancePaid}
                  onChange={(e) => setEditPayment((p) => ({ ...p, balancePaid: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm text-gray-700">Balance paid</span>
              </label>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Offline / Manual Payment</p>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount Received ($)</label>
                  <input type="number" min="0" step="0.01"
                    value={editPayment.offlinePaymentAmount}
                    onChange={(e) => setEditPayment((p) => ({ ...p, offlinePaymentAmount: e.target.value }))}
                    className="input-field text-sm w-full" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Method</label>
                  <select value={editPayment.offlinePaymentMethod}
                    onChange={(e) => setEditPayment((p) => ({ ...p, offlinePaymentMethod: e.target.value }))}
                    className="input-field text-sm w-full">
                    <option value="">Select method</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="venmo">Venmo</option>
                    <option value="zelle">Zelle</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <input value={editPayment.offlinePaymentNote}
                onChange={(e) => setEditPayment((p) => ({ ...p, offlinePaymentNote: e.target.value }))}
                className="input-field text-sm w-full" placeholder="Payment note (optional)" />
            </div>
            <button onClick={async () => {
              await update({
                depositPaid:          editPayment.depositPaid,
                depositAmount:        editPayment.depositAmount,
                balancePaid:          editPayment.balancePaid,
                remainingBalance:     editPayment.balancePaid ? 0 : (booking.totalPrice || 0) - editPayment.depositAmount,
                offlinePaymentAmount: editPayment.offlinePaymentAmount ? Number(editPayment.offlinePaymentAmount) : null,
                offlinePaymentMethod: editPayment.offlinePaymentMethod || null,
                offlinePaymentNote:   editPayment.offlinePaymentNote   || null,
                totalPrice:           booking.totalPrice,
              });
              setEditingPayment(false);
            }} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
              {saving ? "Saving…" : "Save Payment"}
            </button>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">${booking.totalPrice}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Deposit</span>
              <span className={booking.depositPaid ? "text-green-600" : "text-gray-400"}>
                ${booking.depositAmount} {booking.depositPaid ? "✓ paid" : "(unpaid)"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Balance</span>
              <span className={booking.balancePaid ? "text-green-600" : "text-gray-400"}>
                ${booking.remainingBalance} {booking.balancePaid ? "✓ paid" : "(pending)"}
              </span>
            </div>
            {booking.offlinePaymentMethod && (
              <div className="flex justify-between pt-1 border-t border-gray-100 mt-1">
                <span className="text-gray-500">Manual payment</span>
                <span className="text-gray-700">
                  ${booking.offlinePaymentAmount} via {booking.offlinePaymentMethod}
                  {booking.offlinePaymentNote && <span className="text-gray-400"> · {booking.offlinePaymentNote}</span>}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weather */}
      {showWeather && <WeatherWidget booking={booking} tempUnit={tempUnit} />}

      {/* Signed Service Agreement */}
      {booking.contractSigned && (
        <SignedAgreementPanel booking={booking} />
      )}

      {/* Job Costs */}
      {(() => {
        const totalCost   = (Number(costs.shooterFee) || 0) + (Number(costs.editorFee) || 0) + (Number(costs.travelCost) || 0) + (Number(costs.otherCosts) || 0);
        const totalPrice  = booking.totalPrice || 0;
        const profit      = totalPrice - totalCost;
        const margin      = totalPrice > 0 ? Math.round((profit / totalPrice) * 100) : null;
        return (
          <div className="card mb-6">
            <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4">Job Costs &amp; Profit</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Shooter Fee",  key: "shooterFee"  },
                { label: "Editor Fee",   key: "editorFee"   },
                { label: "Travel Cost",  key: "travelCost"  },
                { label: "Other Costs",  key: "otherCosts"  },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={costs[key]}
                      onChange={(e) => setCosts((c) => ({ ...c, [key]: e.target.value }))}
                      className="input-field pl-6 text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shoot Hours</label>
                <input
                  type="number" min="0" step="0.5"
                  value={costs.shootHours}
                  onChange={(e) => setCosts((c) => ({ ...c, shootHours: e.target.value }))}
                  className="input-field text-sm w-full"
                  placeholder="e.g. 2.5"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Edit Hrs / Photo</label>
                <input
                  type="number" min="0" step="0.01"
                  value={costs.editHoursPerPhoto}
                  onChange={(e) => setCosts((c) => ({ ...c, editHoursPerPhoto: e.target.value }))}
                  className="input-field text-sm w-full"
                  placeholder="e.g. 0.05"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Notes (contractor, vendor…)</label>
              <input
                type="text"
                value={costs.notes}
                onChange={(e) => setCosts((c) => ({ ...c, notes: e.target.value }))}
                className="input-field text-sm w-full"
                placeholder="e.g. Edited by Jane Doe"
              />
            </div>
            {/* Profit summary */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total Cost</p>
                <p className="font-semibold text-[#0F172A]">${totalCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Revenue</p>
                <p className="font-semibold text-[#0F172A]">${totalPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Net Profit</p>
                <p className={`font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${profit.toLocaleString()}
                  {margin !== null && <span className="font-normal text-xs ml-1">({margin}%)</span>}
                </p>
              </div>
            </div>
            {costsMsg && (
              <p className="text-xs text-blue-600 mb-3">{costsMsg}</p>
            )}
            <div className="flex items-center gap-3">
              <button onClick={saveCosts} disabled={costsSaving} className="btn-outline text-sm px-4 py-2">
                {costsSaving ? "Saving…" : "Save Costs"}
              </button>
              {globalCostRates && (
                <button
                  type="button"
                  onClick={() => setCosts((c) => ({ ...c, otherCosts: globalCostRates.otherFlat || 0 }))}
                  className="text-xs text-[#3486cf] underline"
                  title="Fill in default rates from Settings → Cost Rates"
                >
                  Apply global rates
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Status + shoot date */}
      <div className="card mb-6">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4">Manage Booking</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Status</label>
            <select
              value={booking.status}
              onChange={(e) => update({ status: e.target.value })}
              className="input-field w-full">
              <option value="pending_payment">Pending payment</option>
              <option value="requested">Pending review</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Shoot Date</label>
            <div className="flex gap-2">
              <input type="date" value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="input-field flex-1" />
              <button onClick={() => update({ shootDate })} disabled={saving}
                className="btn-outline px-3 py-2 text-xs">Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Listing Workspace */}
      {booking.isListing === false && (
        <div className="card mb-6 border-[#3486cf]/20 bg-[#EEF5FC]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1E5A8A] mb-0.5">Create Listing Workspace</p>
              <p className="text-xs text-[#3486cf]/80">
                This booking is an order record only. Promote it to a listing workspace to access the Property Site, Marketing tools, and Gallery delivery — and to count it against your listing credit.
              </p>
            </div>
            <button
              onClick={async () => {
                setConvertingToListing(true);
                setMsg("");
                try {
                  const token = await auth.currentUser.getIdToken();
                  const res = await fetch(`/api/dashboard/bookings/${id}/convert-to-listing`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setBooking((b) => ({ ...b, isListing: true }));
                    setMsg("Listing workspace created. You can now open it from the Listings page.");
                  } else {
                    setMsg(data.error || "Failed to create listing workspace.");
                  }
                } catch {
                  setMsg("Something went wrong.");
                } finally {
                  setConvertingToListing(false);
                }
              }}
              disabled={convertingToListing}
              className="flex-shrink-0 bg-[#3486cf] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#3486cf]/90 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {convertingToListing ? "Creating…" : "Create Listing Workspace →"}
            </button>
          </div>
        </div>
      )}
      {booking.isListing === true && (
        <div className="mb-6">
          <Link href={`/dashboard/listings/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#3486cf] border border-[#3486cf]/30 px-4 py-2 rounded-xl hover:bg-[#3486cf]/5 transition-colors font-medium">
            Open Listing Workspace →
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Deposit request — show when deposit not yet paid */}
        {!booking.depositPaid && (
          <div className="flex flex-col gap-1.5">
            <button onClick={sendDepositRequest} disabled={saving}
              className="btn-primary px-4 py-2 text-sm">
              {saving ? "Generating…" : "📋 Copy Deposit Link"}
            </button>
            {booking.depositCheckoutUrl && (
              <a href={booking.depositCheckoutUrl} target="_blank" rel="noreferrer"
                className="text-xs text-[#3486cf]/60 hover:text-[#3486cf] underline text-center">
                View deposit page →
              </a>
            )}
          </div>
        )}
        {booking.depositPaid && booking.status === "requested" && (
          <button onClick={sendConfirmation} disabled={saving}
            className="btn-primary px-4 py-2 text-sm">
            Send Confirmation Email
          </button>
        )}
        {booking.status === "completed" && !booking.galleryId && (
          <button onClick={createGallery} disabled={saving}
            className="btn-gold px-4 py-2 text-sm">
            Create Gallery
          </button>
        )}
        {booking.galleryId && (
          <div className="flex flex-col gap-1.5">
            <Link href={`/dashboard/galleries/${booking.galleryId}`}
              className="btn-primary px-4 py-2 text-sm">
              Manage Gallery / Deliver →
            </Link>
          </div>
        )}
        {/* Invoice */}
        <Link href={`/dashboard/bookings/${id}/invoice`} target="_blank"
          className="btn-outline px-4 py-2 text-sm">
          🧾 View Invoice
        </Link>
        {(booking.shootDate || booking.preferredDate) && (
          <div className="flex flex-col gap-1.5">
            <a
              href={(() => {
                const dateRaw = booking.shootDate || booking.preferredDate;
                const dateStr = dateRaw?.split?.("T")?.[0]?.replace(/-/g, "") || "";
                const title   = encodeURIComponent(`Photo Shoot — ${booking.fullAddress || booking.address || "Property"}`);
                const details = encodeURIComponent(`Client: ${booking.clientName}\n${booking.clientEmail}`);
                const loc     = encodeURIComponent(booking.fullAddress || booking.address || "");
                return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}&location=${loc}`;
              })()}
              target="_blank" rel="noreferrer"
              className="btn-outline px-4 py-2 text-sm">
              📅 Add to Google Calendar
            </a>
            <button
              onClick={async () => {
                const token = await auth.currentUser.getIdToken();
                const res = await fetch(`/api/dashboard/bookings/${id}/ics`, { headers: { Authorization: `Bearer ${token}` } });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `booking-${id}.ics`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs text-[#3486cf]/60 hover:text-[#3486cf] underline text-center">
              Download .ics (Apple / Outlook)
            </button>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="card mt-6">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4">Activity Log</h3>

        {/* Add note */}
        <div className="flex gap-2 mb-5">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postNote(); } }}
            className="input-field text-sm flex-1"
            placeholder="Add a note (press Enter)…"
          />
          <button onClick={postNote} disabled={postingNote || !noteText.trim()}
            className="btn-outline text-sm px-3 py-2 disabled:opacity-40">
            {postingNote ? "…" : "Add"}
          </button>
        </div>

        {!activityLoaded ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
            Loading activity…
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((e, i) => {
              const ts = e.changedAt ? new Date(e.changedAt) : null;
              const timeStr = ts ? ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

              if (e.type === "note") {
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm">
                    <span className="text-base mt-0.5 flex-shrink-0">📝</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800">{e.note}</p>
                      {timeStr && <p className="text-xs text-gray-400 mt-0.5">{timeStr}</p>}
                    </div>
                  </div>
                );
              }

              const s = WORKFLOW_STATUS_MAP[e.status];
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-xl text-sm">
                  <span className="text-base mt-0.5 flex-shrink-0">🔄</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s?.bg || "bg-gray-100"} ${s?.text || "text-gray-600"}`}>
                        {s?.label || e.status?.replace(/_/g, " ")}
                      </span>
                      {e.note && <span className="text-gray-500 text-xs italic">"{e.note}"</span>}
                    </div>
                    {timeStr && <p className="text-xs text-gray-400 mt-0.5">{timeStr}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
