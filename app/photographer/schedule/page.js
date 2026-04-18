"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";

const DAYS_SHORT  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const BLOCK_REASONS = ["Day Off","Vacation","Personal","Sick Day","Holiday","Other"];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDates(anchor) {
  const d = new Date(anchor);
  d.setHours(0,0,0,0);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export default function PhotographerSchedulePage() {
  const [bookings,  setBookings]  = useState([]);
  const [blocks,    setBlocks]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [anchor,    setAnchor]    = useState(new Date());
  const [view,      setView]      = useState("week"); // week | month
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ startDate: "", endDate: "", reason: "Day Off", note: "" });
  const [saving,    setSaving]    = useState(false);
  const [memberColor, setMemberColor] = useState("#0b2a55");

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [bRes, blRes, meRes] = await Promise.all([
        fetch("/api/photographer/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/photographer/blocks",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/photographer/me",       { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [bData, blData, meData] = await Promise.all([bRes.json(), blRes.json(), meRes.json()]);
      setBookings(bData.bookings || []);
      setBlocks(blData.blocks   || []);
      setMemberColor(meData.member?.color || "#0b2a55");
      setLoading(false);
    }
    load();
  }, []);

  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);

  const calEvents = useMemo(() => {
    return bookings
      .filter((b) => (b.shootDate || b.preferredDate) && b.status !== "cancelled")
      .map((b) => {
        const ds = b.shootDate || b.preferredDate;
        const dateObj = new Date(ds.length === 10 ? ds + "T12:00:00" : ds);
        return { ...b, dateObj };
      });
  }, [bookings]);

  const monthDates = useMemo(() => {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchor]);

  function prevPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      view === "month" ? n.setMonth(n.getMonth() - 1) : n.setDate(n.getDate() - 7);
      return n;
    });
  }
  function nextPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      view === "month" ? n.setMonth(n.getMonth() + 1) : n.setDate(n.getDate() + 7);
      return n;
    });
  }

  async function addBlock() {
    if (!blockForm.startDate || !blockForm.endDate) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch("/api/photographer/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(blockForm),
    });
    const data = await res.json();
    if (res.ok) {
      setBlocks((prev) => [...prev, data.block]);
      setShowBlock(false);
      setBlockForm({ startDate: "", endDate: "", reason: "Day Off", note: "" });
    }
    setSaving(false);
  }

  async function deleteBlock(id) {
    const token = await getToken();
    await fetch(`/api/photographer/blocks?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl text-gray-900">Schedule</h1>
          <p className="text-gray-400 text-sm mt-0.5">Your upcoming shoots and blocked time</p>
        </div>
        <button onClick={() => setShowBlock(true)} className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
          🚫 Block Time Off
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={prevPeriod} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={() => setAnchor(new Date())} className="text-xs border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50">Today</button>
            <button onClick={nextPeriod} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <p className="font-semibold text-gray-800 text-sm">
              {view === "month"
                ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
                : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`}
            </p>
          </div>
          <div className="flex border border-gray-200 rounded overflow-hidden text-xs">
            {["week","month"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize font-medium transition-colors ${
                  view === v ? "bg-navy text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>{v}</button>
            ))}
          </div>
        </div>

        {/* Week view */}
        {view === "week" && (
          <>
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDates.map((d) => {
                const isToday = isSameDay(d, today);
                return (
                  <div key={d.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-navy/4" : ""}`}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                    <p className={`text-sm font-bold mt-0.5 ${isToday ? "w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center mx-auto" : "text-gray-800"}`}>
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 min-h-32">
              {weekDates.map((d) => {
                const dayEvents = calEvents.filter((e) => isSameDay(e.dateObj, d));
                const isToday   = isSameDay(d, today);
                const dayStr    = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                const dayBlocks = blocks.filter((b) => dayStr >= b.startDate.slice(0,10) && dayStr <= b.endDate.slice(0,10));
                return (
                  <div key={d.toISOString()} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-32 relative ${isToday ? "bg-navy/2" : ""}`}>
                    {dayBlocks.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "repeating-linear-gradient(-45deg,#fee2e2,#fee2e2 3px,transparent 3px,transparent 10px)", opacity: 0.6 }} />
                    )}
                    {dayBlocks.map((bl) => (
                      <div key={bl.id} className="text-xs bg-red-100 border-l-2 border-red-400 px-1.5 py-0.5 rounded-sm mb-1 flex items-center justify-between group relative z-10">
                        <span className="text-red-600 font-medium truncate">{bl.reason}</span>
                        <button onClick={() => deleteBlock(bl.id)}
                          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 ml-1 text-[10px]">×</button>
                      </div>
                    ))}
                    {dayEvents.map((ev) => (
                      <div key={ev.id} style={{ background: memberColor + "22", borderLeftColor: memberColor }}
                        className="text-xs border-l-2 px-1.5 py-1 rounded-sm mb-1 relative z-10">
                        <p className="font-medium truncate" style={{ color: memberColor }}>{ev.address?.split(",")[0] || "Shoot"}</p>
                        {ev.preferredTime && <p className="text-gray-400 capitalize">{ev.preferredTime}</p>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Month view */}
        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-xs text-gray-400 uppercase tracking-wide border-r last:border-r-0 border-gray-100">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDates.map((d, i) => {
                if (!d) return <div key={`e-${i}`} className="border-r last:border-r-0 border-b border-gray-100 min-h-20 bg-gray-50/30" />;
                const isToday   = isSameDay(d, today);
                const dayEvents = calEvents.filter((e) => isSameDay(e.dateObj, d));
                const dayStr    = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                const hasBlock  = blocks.some((b) => dayStr >= b.startDate.slice(0,10) && dayStr <= b.endDate.slice(0,10));
                return (
                  <div key={d.toISOString()} className={`border-r last:border-r-0 border-b border-gray-100 min-h-20 p-1 ${isToday ? "bg-blue-50/30" : ""} ${hasBlock ? "bg-red-50/40" : ""}`}>
                    <p className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-navy text-white" : "text-gray-800"}`}>
                      {d.getDate()}
                    </p>
                    {dayEvents.slice(0,2).map((ev) => (
                      <div key={ev.id} style={{ background: memberColor + "22", borderLeftColor: memberColor }}
                        className="text-xs border-l-2 px-1 py-0.5 rounded-sm mb-0.5 truncate">
                        <span style={{ color: memberColor }} className="font-medium">{ev.address?.split(",")[0] || "Shoot"}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && <p className="text-xs text-gray-400">+{dayEvents.length - 2}</p>}
                    {hasBlock && <p className="text-[10px] text-red-500 font-medium">Blocked</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Existing blocks list */}
      {blocks.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="font-semibold text-gray-800 text-sm">Your Time-Off Blocks</p>
          </div>
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 border-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-800">{b.reason}</p>
                <p className="text-xs text-gray-400">
                  {new Date(b.startDate + "T12:00:00").toLocaleDateString()} – {new Date(b.endDate + "T12:00:00").toLocaleDateString()}
                  {b.note && ` · ${b.note}`}
                </p>
              </div>
              <button onClick={() => deleteBlock(b.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Block time modal */}
      {showBlock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Block Time Off</h2>
              <button onClick={() => setShowBlock(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Start Date</label>
                  <input type="date" value={blockForm.startDate}
                    onChange={(e) => setBlockForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="label-field">End Date</label>
                  <input type="date" value={blockForm.endDate} min={blockForm.startDate}
                    onChange={(e) => setBlockForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="label-field">Reason</label>
                <select value={blockForm.reason}
                  onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                  className="input-field w-full">
                  {BLOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Note (optional)</label>
                <input type="text" value={blockForm.note}
                  onChange={(e) => setBlockForm((f) => ({ ...f, note: e.target.value }))}
                  className="input-field w-full" placeholder="e.g. Family trip" />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={addBlock} disabled={saving || !blockForm.startDate || !blockForm.endDate}
                className="btn-primary flex-1 py-2 text-sm">
                {saving ? "Saving…" : "Block These Dates"}
              </button>
              <button onClick={() => setShowBlock(false)} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
