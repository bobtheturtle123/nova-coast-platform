"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { resolveWorkflowStatus, WORKFLOW_STATUSES } from "@/lib/workflowStatus";

const STATUS_LABELS = {
  requested:  { label: "Requested",  color: "bg-amber-100 text-amber-700" },
  confirmed:  { label: "Confirmed",  color: "bg-blue-100 text-blue-700" },
  completed:  { label: "Completed",  color: "bg-green-100 text-green-700" },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-700" },
};

function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function getShootDateStr(b) {
  return (b.shootDate || b.preferredDate || "").slice(0, 10);
}

function BookingCard({ b, member, highlight }) {
  const wfStatus = resolveWorkflowStatus(b);
  const wfDef    = WORKFLOW_STATUSES.find((s) => s.id === wfStatus);
  const st       = wfDef
    ? { label: wfDef.label, color: `${wfDef.bg} ${wfDef.text}` }
    : (STATUS_LABELS[b.status] || { label: b.status, color: "bg-gray-100 text-gray-600" });
  const date = b.shootDate || b.preferredDate;
  return (
    <Link href={`/photographer/shoots/${b.id}`}
      className={`block rounded-lg px-5 py-4 hover:shadow-sm transition-shadow ${
        highlight
          ? "bg-[#EEF5FC] border-2 border-[#3486cf]/40"
          : "bg-white border border-gray-200"
      }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {highlight && (
            <span className="inline-block text-[10px] font-bold text-[#3486cf] uppercase tracking-wider mb-1">Today</span>
          )}
          <p className="font-semibold text-gray-900 truncate">{b.fullAddress || b.address || "Address TBD"}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {b.clientName && <span>{b.clientName} · </span>}
            {formatDate(date)}
            {b.preferredTime && <span className="capitalize"> · {b.preferredTime}</span>}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${st.color}`}>{st.label}</span>
      </div>
      {(b.serviceIds?.length > 0 || b.packageId) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {b.packageId && <span className="text-xs bg-[#3486cf]/8 text-[#3486cf] px-2 py-0.5 rounded-xl">{b.packageId}</span>}
          {(b.serviceIds || []).map((s) => (
            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-xl">{s}</span>
          ))}
        </div>
      )}
      {(b.payRate != null || member?.payRate > 0) && (
        <p className="text-xs text-green-700 font-medium mt-2">
          Your pay: ${b.payRate != null ? Number(b.payRate).toLocaleString() : Number(member?.payRate || 0).toLocaleString()}
        </p>
      )}
      {b.notes && (
        <p className="text-xs text-gray-400 mt-2 italic">{b.notes}</p>
      )}
    </Link>
  );
}

function BookingsList({ bookings, today, member }) {
  const todayShoots = bookings.filter((b) => getShootDateStr(b) === today);
  const rest        = bookings.filter((b) => getShootDateStr(b) !== today);
  return (
    <div className="space-y-5">
      {todayShoots.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#3486cf] uppercase tracking-wider mb-2">Today's Shoots</p>
          <div className="space-y-3">
            {todayShoots.map((b) => <BookingCard key={b.id} b={b} member={member} highlight />)}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {todayShoots.length > 0 && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
          )}
          <div className="space-y-3">
            {rest.map((b) => <BookingCard key={b.id} b={b} member={member} highlight={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhotographerShootsPage() {
  const [bookings, setBookings] = useState([]);
  const [member,   setMember]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("upcoming"); // upcoming | all | completed

  useEffect(() => {
    async function load() {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const [meRes, bRes] = await Promise.all([
        fetch("/api/photographer/me",       { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/photographer/bookings", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [meData, bData] = await Promise.all([meRes.json(), bRes.json()]);
      setMember(meData.member || null);
      setBookings(bData.bookings || []);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const filtered = bookings.filter((b) => {
    const d = b.shootDate || b.preferredDate || "";
    if (filter === "upcoming")  return d >= today && b.status !== "cancelled" && b.status !== "completed";
    if (filter === "completed") return b.status === "completed";
    return true;
  });

  const upcoming = bookings.filter((b) => {
    const d = b.shootDate || b.preferredDate || "";
    return d >= today && b.status !== "cancelled" && b.status !== "completed";
  });

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-gray-900">
          {member?.name ? `Hey, ${member.name.split(" ")[0]}` : "My Shoots"}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {upcoming.length > 0
            ? `${upcoming.length} upcoming shoot${upcoming.length !== 1 ? "s" : ""}`
            : "No upcoming shoots — enjoy the break!"}
        </p>
      </div>

      {/* Stats strip */}
      {member?.payRate > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">My Rate</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">${Number(member.payRate).toLocaleString()}</p>
            <p className="text-xs text-gray-400">per shoot</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Upcoming</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{upcoming.length}</p>
            <p className="text-xs text-gray-400">shoots</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Est. Earnings</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              ${(upcoming.length * Number(member.payRate)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">upcoming</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[["upcoming","Upcoming"], ["all","All"], ["completed","Completed"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === val ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-3xl mb-2">📅</p>
          <p className="font-medium text-gray-500">No shoots here yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === "upcoming" ? "Your upcoming bookings will appear here once assigned." : "Nothing to show."}
          </p>
        </div>
      ) : (
        <BookingsList bookings={filtered} today={today} member={member} />
      )}
    </div>
  );
}
