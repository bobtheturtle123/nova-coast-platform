"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  const [bookings,    setBookings]    = useState([]);
  const [blocks,      setBlocks]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [anchor,      setAnchor]      = useState(new Date());
  const [view,        setView]        = useState("week"); // week | month
  const [showBlock,   setShowBlock]   = useState(false);
  const [blockForm,   setBlockForm]   = useState({ startDate: "", endDate: "", reason: "Day Off", note: "", allDay: true, startTime: "09:00", endTime: "17:00" });
  const [saving,      setSaving]      = useState(false);
  const [memberColor,    setMemberColor]    = useState("#3486cf");
  const [hasGcal,        setHasGcal]        = useState(false);
  const [gcalId,         setGcalId]         = useState("primary");
  const [syncing,        setSyncing]        = useState(false);
  const [syncMsg,        setSyncMsg]        = useState("");
  const [showCalConfig,  setShowCalConfig]  = useState(false);
  const [calIdInput,     setCalIdInput]     = useState("");
  const [savingCalId,    setSavingCalId]    = useState(false);
  const [disconnecting,  setDisconnecting]  = useState(false);

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
      setMemberColor(meData.member?.color || "#3486cf");
      const gcal = meData.member?.googleCalendar;
      setHasGcal(!!gcal?.refreshToken || !!gcal?.connected);
      const storedId = gcal?.calendarId || "primary";
      setGcalId(storedId);
      setCalIdInput(storedId === "primary" ? "" : storedId);
      setLoading(false);
    }
    load();
  }, []);

  async function syncGoogleCalendar() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const token = await getToken();
      const res = await fetch("/api/photographer/google-sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const blRes  = await fetch("/api/photographer/blocks", { headers: { Authorization: `Bearer ${token}` } });
        const blData = await blRes.json();
        setBlocks(blData.blocks || []);
        setSyncMsg(`Synced ${data.synced} event${data.synced !== 1 ? "s" : ""} from Google Calendar`);
      } else {
        setSyncMsg(data.error || "Sync failed");
      }
    } catch {
      setSyncMsg("Sync failed — check your connection");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 5000);
  }

  async function saveCalendarId() {
    setSavingCalId(true);
    try {
      const token = await getToken();
      const id    = calIdInput.trim() || "primary";
      const res   = await fetch("/api/photographer/google-sync", {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ calendarId: id }),
      });
      if (res.ok) {
        setGcalId(id);
        setSyncMsg("Calendar updated — tap Sync to refresh blocks");
        setShowCalConfig(false);
        setTimeout(() => setSyncMsg(""), 4000);
      }
    } catch { /* ignore */ }
    setSavingCalId(false);
  }

  async function disconnectGoogleCalendar() {
    if (!confirm("Disconnect Google Calendar? All synced busy blocks will be removed.")) return;
    setDisconnecting(true);
    try {
      const token = await getToken();
      await fetch("/api/photographer/google-sync", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setHasGcal(false);
      setBlocks((prev) => prev.filter((b) => b.source !== "google"));
      setSyncMsg("Google Calendar disconnected");
      setTimeout(() => setSyncMsg(""), 4000);
    } catch { /* ignore */ }
    setDisconnecting(false);
  }

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
      setBlockForm({ startDate: "", endDate: "", reason: "Day Off", note: "", allDay: true, startTime: "09:00", endTime: "17:00" });
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
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl text-gray-900">Schedule</h1>
          <p className="text-gray-400 text-sm mt-0.5">Your upcoming shoots and blocked time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasGcal && (
            <>
              <button onClick={syncGoogleCalendar} disabled={syncing}
                className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={syncing ? "animate-spin" : ""}>
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                {syncing ? "Syncing…" : "Sync Google"}
              </button>
              <button onClick={() => setShowCalConfig((v) => !v)}
                className="btn-outline text-sm px-3 py-2 flex items-center gap-1.5"
                title="Google Calendar settings">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
              <button onClick={disconnectGoogleCalendar} disabled={disconnecting}
                className="text-sm px-3 py-2 flex items-center gap-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          )}
          <button onClick={() => setShowBlock(true)} className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
            🚫 Block Time Off
          </button>
        </div>
      </div>
      {syncMsg && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${syncMsg.toLowerCase().includes("sync") || syncMsg.includes("updated") || syncMsg.includes("disconnect") ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
          {syncMsg}
        </div>
      )}

      {showCalConfig && hasGcal && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Google Calendar Settings</p>
          <div>
            <label className="label-field">Calendar to sync</label>
            <p className="text-xs text-gray-400 mb-1.5">
              By default, your primary calendar is synced. To sync only a specific work calendar, paste its
              Calendar ID — find it in Google Calendar › Settings › [Calendar name] › Integrate calendar.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={calIdInput}
                onChange={(e) => setCalIdInput(e.target.value)}
                placeholder="primary (default) or paste calendar ID"
                className="input-field flex-1 text-sm"
              />
              <button onClick={saveCalendarId} disabled={savingCalId}
                className="btn-primary text-sm px-4 py-2 shrink-0">
                {savingCalId ? "Saving…" : "Save"}
              </button>
            </div>
            {gcalId !== "primary" && (
              <p className="text-xs text-[#3486cf] mt-1">Currently syncing: {gcalId}</p>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Remove connection and clear synced blocks</p>
            <button onClick={disconnectGoogleCalendar} disabled={disconnecting}
              className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
              {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
            </button>
          </div>
        </div>
      )}

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
                  view === v ? "bg-[#3486cf] text-white" : "text-gray-500 hover:bg-gray-50"
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
                  <div key={d.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-[#3486cf]/4" : ""}`}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                    <p className={`text-sm font-bold mt-0.5 ${isToday ? "w-7 h-7 rounded-full bg-[#3486cf] text-white flex items-center justify-center mx-auto" : "text-gray-800"}`}>
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
                const hasAllDay = dayBlocks.some((b) => b.allDay);
                return (
                  <div key={d.toISOString()} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-32 relative ${isToday ? "bg-[#3486cf]/2" : ""}`}>
                    {hasAllDay && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "repeating-linear-gradient(-45deg,#fee2e2,#fee2e2 3px,transparent 3px,transparent 10px)", opacity: 0.6 }} />
                    )}
                    {dayBlocks.map((bl) => (
                      <div key={bl.id} className={`text-xs border-l-2 px-1.5 py-0.5 rounded-xl mb-1 flex items-center justify-between group relative z-10 ${
                        bl.source === "google" ? "bg-blue-50 border-blue-400" : "bg-red-100 border-red-400"
                      }`}>
                        <span className={`font-medium truncate ${bl.source === "google" ? "text-blue-600" : "text-red-600"}`}>
                          {bl.source === "google" ? `G: ${bl.note || "Busy"}` : bl.reason}
                        </span>
                        <button onClick={() => deleteBlock(bl.id)}
                          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 ml-1 text-[10px]">×</button>
                      </div>
                    ))}
                    {dayEvents.map((ev) => (
                      <Link key={ev.id} href={`/photographer/shoots/${ev.id}`}
                        style={{ background: memberColor + "22", borderLeftColor: memberColor }}
                        className="block text-xs border-l-2 px-1.5 py-1 rounded-xl mb-1 relative z-10 hover:opacity-80 transition-opacity">
                        <p className="font-medium truncate" style={{ color: memberColor }}>{ev.address?.split(",")[0] || "Shoot"}</p>
                        {ev.clientName && <p className="text-gray-500 truncate">{ev.clientName}</p>}
                        {(ev.shootTime || ev.preferredTime) && <p className="text-gray-400 capitalize">{ev.shootTime || ev.preferredTime}</p>}
                      </Link>
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
                const hasBlock  = blocks.some((b) => b.allDay && dayStr >= b.startDate.slice(0,10) && dayStr <= b.endDate.slice(0,10));
                return (
                  <div key={d.toISOString()} className={`border-r last:border-r-0 border-b border-gray-100 min-h-20 p-1 ${isToday ? "bg-blue-50/30" : ""} ${hasBlock ? "bg-red-50/40" : ""}`}>
                    <p className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-[#3486cf] text-white" : "text-gray-800"}`}>
                      {d.getDate()}
                    </p>
                    {dayEvents.slice(0,2).map((ev) => (
                      <Link key={ev.id} href={`/photographer/shoots/${ev.id}`}
                        style={{ background: memberColor + "22", borderLeftColor: memberColor }}
                        className="block text-xs border-l-2 px-1 py-0.5 rounded-xl mb-0.5 truncate hover:opacity-80 transition-opacity">
                        <span style={{ color: memberColor }} className="font-medium">{ev.address?.split(",")[0] || "Shoot"}</span>
                        {ev.clientName && <span className="text-gray-500 ml-1">{ev.clientName}</span>}
                      </Link>
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
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="font-semibold text-gray-800 text-sm">Your Time-Off Blocks</p>
            {blocks.some((b) => b.source === "google") && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-300" /> Google Calendar events shown. Remove any that shouldn't block bookings.
              </span>
            )}
          </div>
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 border-gray-50">
              <div className="flex items-center gap-3">
                {b.source === "google" ? (
                  <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium shrink-0">Google</span>
                ) : (
                  <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-medium shrink-0">Manual</span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.reason}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.startDate + "T12:00:00").toLocaleDateString()} – {new Date(b.endDate + "T12:00:00").toLocaleDateString()}
                    {!b.allDay && b.startTime && b.endTime && ` · ${b.startTime} – ${b.endTime}`}
                    {b.note && ` · ${b.note}`}
                  </p>
                </div>
              </div>
              <button onClick={() => deleteBlock(b.id)} className="text-xs text-red-400 hover:text-red-600 font-medium shrink-0">Remove</button>
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
                    onChange={(e) => setBlockForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="label-field">End Date</label>
                  <input type="date" value={blockForm.endDate} min={blockForm.startDate}
                    onChange={(e) => setBlockForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="input-field w-full" />
                </div>
              </div>
              {/* All day toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={!!blockForm.allDay}
                  onChange={(e) => setBlockForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="w-4 h-4 accent-[#3486cf]" />
                <span className="text-sm text-gray-700">All day</span>
              </label>
              {!blockForm.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Start Time</label>
                    <input type="time" value={blockForm.startTime}
                      onChange={(e) => setBlockForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="input-field w-full" />
                  </div>
                  <div>
                    <label className="label-field">End Time</label>
                    <input type="time" value={blockForm.endTime}
                      onChange={(e) => setBlockForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="input-field w-full" />
                  </div>
                </div>
              )}
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
