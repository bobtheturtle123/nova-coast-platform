"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { WORKFLOW_STATUSES } from "@/lib/workflowStatus";

function fmt(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const PHOTOGRAPHER_ACTIONS = [
  { id: "shot_completed", label: "Mark Shot Complete", color: "bg-cyan-600 hover:bg-cyan-700" },
  { id: "postponed",      label: "Mark Postponed",     color: "bg-amber-500 hover:bg-amber-600" },
  { id: "cancelled",      label: "Mark Cancelled",     color: "bg-red-500 hover:bg-red-600" },
];

export default function ShootDetailPage() {
  const { bookingId } = useParams();
  const router = useRouter();

  const [booking,     setBooking]     = useState(null);
  const [notes,       setNotes]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [statusMsg,   setStatusMsg]   = useState("");
  const [confirmingStatus, setConfirmingStatus] = useState(null);

  async function getToken() {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) { router.push("/auth/login"); return; }

      const [bookRes, notesRes] = await Promise.all([
        fetch(`/api/photographer/bookings/${bookingId}`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/photographer/bookings/${bookingId}/notes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const bData = await bookRes.json();
      const nData = await notesRes.json();

      if (!bData.booking) { setLoading(false); return; }
      setBooking(bData.booking);
      setNotes(nData.photographerNotes || "");
      setLoading(false);
    }
    load();
  }, [bookingId, router]);

  async function saveNotes() {
    setSaving(true);
    const token = await getToken();
    await fetch(`/api/photographer/bookings/${bookingId}/notes`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ notes }),
    });
    setSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  }

  async function updateStatus(workflowStatus) {
    if (confirmingStatus !== workflowStatus) {
      setConfirmingStatus(workflowStatus);
      return;
    }
    setConfirmingStatus(null);
    const token = await getToken();
    const res = await fetch(`/api/photographer/bookings/${bookingId}/status`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ workflowStatus }),
    });
    const data = await res.json();
    if (data.ok) {
      setStatusMsg(`Status updated to "${workflowStatus.replace(/_/g, " ")}"`);
      setBooking((b) => ({ ...b, workflowStatus }));
      setTimeout(() => setStatusMsg(""), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Booking not found or not assigned to you.</p>
        <Link href="/photographer" className="text-[#3486cf] text-sm mt-3 inline-block">← Back to My Shoots</Link>
      </div>
    );
  }

  const currentStatus = WORKFLOW_STATUSES.find((s) => s.id === (booking.workflowStatus || booking.status)) || null;
  const mapsQuery = encodeURIComponent(booking.fullAddress || booking.address || "");

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Back */}
      <Link href="/photographer" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
        ← My Shoots
      </Link>

      {/* Address + date hero */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Your Shoot</p>
        <h1 className="font-bold text-xl text-gray-900 leading-snug mb-1">{booking.fullAddress || booking.address}</h1>
        <p className="text-sm text-gray-500">{fmt(booking.shootDate || booking.preferredDate)}</p>
        {booking.preferredTime && (
          <p className="text-sm font-medium text-gray-700 mt-0.5 capitalize">{booking.preferredTime}</p>
        )}
        {currentStatus && (
          <span className={`inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full ${currentStatus.bg} ${currentStatus.text}`}>
            {currentStatus.label}
          </span>
        )}
      </div>

      {/* Map link + client contact */}
      <div className="grid grid-cols-2 gap-3">
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
          target="_blank" rel="noopener noreferrer"
          className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors text-center">
          <span className="text-2xl">📍</span>
          <p className="text-sm font-medium text-gray-700">Directions</p>
          <p className="text-xs text-gray-400">Open in Maps</p>
        </a>
        {booking.clientPhone ? (
          <a href={`tel:${booking.clientPhone}`}
            className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors text-center">
            <span className="text-2xl">📞</span>
            <p className="text-sm font-medium text-gray-700">Call Client</p>
            <p className="text-xs text-gray-400 truncate max-w-full">{booking.clientPhone}</p>
          </a>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center opacity-40">
            <span className="text-2xl">📞</span>
            <p className="text-sm font-medium text-gray-500">No Phone</p>
          </div>
        )}
      </div>

      {/* Client info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Client</p>
        <p className="font-semibold text-gray-900">{booking.clientName || "—"}</p>
        {booking.clientPhone && <p className="text-sm text-gray-500 mt-0.5">{booking.clientPhone}</p>}
      </div>

      {/* Services */}
      {(booking.serviceIds?.length > 0 || booking.packageId || booking.addonIds?.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Services</p>
          <div className="flex flex-wrap gap-2">
            {booking.packageId && (
              <span className="text-xs bg-[#3486cf]/10 text-[#3486cf] font-medium px-3 py-1 rounded-full">
                📦 {booking.packageId}
              </span>
            )}
            {(booking.serviceIds || []).map((s) => (
              <span key={s} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{s}</span>
            ))}
            {(booking.addonIds || []).map((a) => (
              <span key={a} className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full">+ {a}</span>
            ))}
          </div>
        </div>
      )}

      {/* Admin notes (read-only for photographer) */}
      {booking.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Notes from Admin</p>
          <p className="text-sm text-amber-800">{booking.notes}</p>
        </div>
      )}

      {/* Photographer notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">My Notes</p>
          {notesSaved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
        </div>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3486cf]/30 resize-none"
          placeholder="Notes about access codes, parking, or special instructions…"
        />
        <button onClick={saveNotes} disabled={saving}
          className="mt-3 text-sm font-medium px-4 py-2 rounded-lg border border-[#3486cf] text-[#3486cf] hover:bg-[#EEF5FC] transition-colors disabled:opacity-50">
          {saving ? "Saving…" : "Save Notes"}
        </button>
      </div>

      {/* Status actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Update Status</p>
        {statusMsg && <p className="text-sm text-emerald-600 mb-3 font-medium">{statusMsg}</p>}
        <div className="flex flex-col gap-2">
          {PHOTOGRAPHER_ACTIONS.map((action) => {
            const isCurrent   = booking.workflowStatus === action.id;
            const isConfirming = confirmingStatus === action.id;
            return (
            <div key={action.id}>
              <button
                onClick={() => { if (!isCurrent) updateStatus(action.id); }}
                disabled={isCurrent}
                className={`w-full text-sm font-semibold py-3 rounded-xl text-white transition-colors disabled:opacity-40 disabled:cursor-default ${
                  isConfirming ? "opacity-70" : ""
                } ${action.color}`}>
                {isCurrent ? "✓ " : ""}{action.label}
              </button>
              {isConfirming && (
                <div className="mt-1.5 flex items-center gap-2 px-1">
                  <p className="text-xs text-gray-500 flex-1">Tap again to confirm</p>
                  <button onClick={() => setConfirmingStatus(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline">Cancel</button>
                </div>
              )}
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}
