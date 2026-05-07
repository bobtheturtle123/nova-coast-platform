"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";

const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TABS = [
  { id: "calendar",    label: "Calendar"    },
  { id: "unscheduled", label: "Unscheduled" },
];

const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── helpers ──────────────────────────────────────────────────────────────────
function avatarColor(str) {
  const p = ["#3486cf","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#b5872d","#c0392b"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function toDateKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Unscheduled tab ─────────────────────────────────────────────────────────
function UnscheduledTab({ listings }) {
  const unscheduled = listings.filter((l) => !l.shootDate && !l.preferredDate);
  const noDate      = listings.filter((l) => l.preferredDate && !l.shootDate);

  if (listings.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  function BookingRow({ l, label }) {
    const wfStatus = resolveWorkflowStatus(l);
    return (
      <Link href={`/dashboard/listings/${l.id}`}
        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#3486cf]/40 hover:shadow-sm transition-all">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: avatarColor(l.clientName || "") }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{l.clientName || "Unnamed"}</p>
          <p className="text-xs text-gray-400 truncate">{l.address?.split(",")[0] || "—"}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-amber-600 font-medium">{label}</span>
          <WorkflowStatusBadge status={wfStatus} size="xs" />
        </div>
      </Link>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      {unscheduled.length === 0 && noDate.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-gray-500">All active bookings have a scheduled date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unscheduled.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                No Date Set ({unscheduled.length})
              </h3>
              <div className="space-y-2">
                {unscheduled.map((l) => <BookingRow key={l.id} l={l} label="No date" />)}
              </div>
            </div>
          )}
          {noDate.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Requested Date Only ({noDate.length})
              </h3>
              <div className="space-y-2">
                {noDate.map((l) => (
                  <BookingRow key={l.id} l={l}
                    label={`Requested: ${new Date(l.preferredDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────
function CalendarTab({ listings, blocks, loading }) {
  const today = new Date();
  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth());
  const [selected, setSelected] = useState(null);
  const [calView,  setCalView]  = useState("month"); // "month" | "week"
  const [weekAnchor, setWeekAnchor] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const byDate = useMemo(() => {
    const map = {};
    listings.forEach((l) => {
      const key = toDateKey(l.shootDate || l.preferredDate);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [listings]);

  const { cells } = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells };
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else             { setMonth(m => m - 1); }
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else              { setMonth(m => m + 1); }
    setSelected(null);
  }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null); }

  function dayKey(d) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const todayKey     = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthPrefix  = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthCount   = Object.entries(byDate).filter(([k]) => k.startsWith(monthPrefix)).reduce((s, [, v]) => s + v.length, 0);
  const selectedListings = selected ? (byDate[selected] || []) : [];

  // Week view helpers
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekAnchor);
      d.setDate(weekAnchor.getDate() + i);
      return d;
    });
  }, [weekAnchor]);

  function prevWeek() { setWeekAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; }); }
  function nextWeek() { setWeekAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; }); }
  function goToWeekToday() {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay());
    setWeekAnchor(d);
  }

  function isBlockedDay(dateKey) {
    return blocks.some((b) => dateKey >= b.startDate?.slice(0,10) && dateKey <= b.endDate?.slice(0,10));
  }
  function getBlocksForDay(dateKey) {
    return blocks.filter((b) => dateKey >= b.startDate?.slice(0,10) && dateKey <= b.endDate?.slice(0,10));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Nav bar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={calView === "month" ? goToday : goToWeekToday}
            className="text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Today
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={calView === "month" ? prevMonth : prevWeek}
              className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-r border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-gray-900 min-w-[160px] text-center">
              {calView === "month"
                ? `${MONTHS[month]} ${year}`
                : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`}
            </span>
            <button onClick={calView === "month" ? nextMonth : nextWeek}
              className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-l border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">
            {calView === "month" ? `${monthCount} shoot${monthCount !== 1 ? "s" : ""} this month` : ""}
          </p>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {["week","month"].map((v) => (
              <button key={v} onClick={() => setCalView(v)}
                className={`px-3 py-2 capitalize font-medium transition-colors ${calView === v ? "bg-[#3486cf] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* ── Week view ── */}
            {calView === "week" && (
              <>
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {weekDates.map((d) => {
                    const isToday = d.toDateString() === today.toDateString();
                    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    const blocked = isBlockedDay(dk);
                    return (
                      <div key={dk} className={`px-2 py-2.5 text-center border-r last:border-r-0 border-gray-100 ${blocked ? "bg-red-50/50" : ""}`}>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                        <p className={`text-sm font-bold mt-0.5 ${isToday ? "w-7 h-7 rounded-full bg-[#3486cf] text-white flex items-center justify-center mx-auto" : "text-gray-800"}`}>
                          {d.getDate()}
                        </p>
                        {blocked && <p className="text-[9px] text-red-400 font-semibold mt-0.5 uppercase tracking-wide">Blocked</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-7 min-h-[200px]">
                  {weekDates.map((d) => {
                    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    const shoots = byDate[dk] || [];
                    const dayBlocks = getBlocksForDay(dk);
                    const isToday = d.toDateString() === today.toDateString();
                    return (
                      <div key={dk} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-[200px] relative ${isToday ? "bg-[#3486cf]/2" : ""}`}>
                        {dayBlocks.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none rounded"
                            style={{ background: "repeating-linear-gradient(-45deg,#fee2e2,#fee2e2 3px,transparent 3px,transparent 10px)", opacity: 0.5 }} />
                        )}
                        {dayBlocks.map((bl) => (
                          <div key={bl.id} className="text-[10px] bg-red-100 border-l-2 border-red-400 px-1.5 py-0.5 rounded mb-1 relative z-10">
                            <span className="text-red-600 font-medium truncate block">{bl.reason}</span>
                            {bl.memberName && <span className="text-red-400">{bl.memberName}</span>}
                          </div>
                        ))}
                        {shoots.map((l) => (
                          <Link key={l.id} href={`/dashboard/listings/${l.id}`}
                            className="block text-[10px] leading-tight px-1.5 py-1 rounded mb-1 font-medium truncate text-white relative z-10 hover:opacity-80"
                            style={{ background: avatarColor(l.clientName || "") }}
                            title={`${l.clientName} · ${l.address?.split(",")[0]}`}>
                            {l.clientName?.split(" ")[0] || "Booking"}
                            {(l.shootTime || l.preferredTime) && (
                              <span className="block font-normal opacity-80">{l.shootTime || l.preferredTime}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Month view ── */}
            {calView === "month" && (
              <>
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {DAYS.map((d) => (
                    <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((day, idx) => {
                    if (!day) return (
                      <div key={`empty-${idx}`}
                        className="min-h-[96px] p-1.5 border-b border-r border-gray-50 bg-gray-50/40"
                        style={{ borderRight: (idx + 1) % 7 === 0 ? "none" : undefined }}
                      />
                    );
                    const key     = dayKey(day);
                    const shoots  = byDate[key] || [];
                    const isToday = key === todayKey;
                    const isSel   = key === selected;
                    const isLast  = (idx + 1) % 7 === 0;
                    const isLastRow = idx >= cells.length - 7;
                    const hasBlock = isBlockedDay(key);
                    const dayBlockList = getBlocksForDay(key);
                    return (
                      <div key={key}
                        onClick={() => setSelected(isSel ? null : key)}
                        className={`min-h-[96px] p-1.5 cursor-pointer transition-colors
                          ${isSel ? "bg-[#EEF5FC]" : hasBlock ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-gray-50"}
                          ${isLastRow ? "" : "border-b border-gray-100"}
                          ${isLast ? "" : "border-r border-gray-100"}
                        `}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                            ${isToday ? "bg-[#3486cf] text-white" : "text-gray-700"}`}>
                            {day}
                          </span>
                          {shoots.length > 2 && <span className="text-[10px] text-gray-400 font-medium">{shoots.length}</span>}
                        </div>
                        <div className="space-y-0.5">
                          {dayBlockList.map((bl) => (
                            <div key={bl.id} className="text-[9px] font-semibold text-red-500 bg-red-100 px-1 py-0.5 rounded truncate">
                              🚫 {bl.reason}{bl.memberName ? ` · ${bl.memberName}` : ""}
                            </div>
                          ))}
                          {shoots.slice(0, 2).map((l) => (
                            <Link key={l.id} href={`/dashboard/listings/${l.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block text-[10px] leading-tight px-1.5 py-0.5 rounded font-medium truncate text-white transition-opacity hover:opacity-80"
                              style={{ background: avatarColor(l.clientName || "") }}
                              title={`${l.clientName} · ${l.address?.split(",")[0]}`}>
                              {l.clientName?.split(" ")[0] || "Booking"}
                            </Link>
                          ))}
                          {shoots.length > 2 && (
                            <span className="block text-[10px] text-gray-400 px-1">+{shoots.length - 2} more</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Day detail / month overview panel */}
        <div className="w-72 flex-shrink-0">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedListings.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">No shoots on this day.</p>
                  <Link href="/dashboard/bookings/create"
                    className="mt-3 inline-block text-xs text-[#3486cf] font-medium hover:underline">
                    + Add booking
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {selectedListings.map((l) => {
                    const wfStatus = resolveWorkflowStatus(l);
                    return (
                      <Link key={l.id} href={`/dashboard/listings/${l.id}`}
                        className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                            style={{ background: avatarColor(l.clientName || "") }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.clientName}</p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{l.address?.split(",")[0]}</p>
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <WorkflowStatusBadge status={wfStatus} size="xs" />
                              {l.totalPrice > 0 && (
                                <span className="text-[11px] text-gray-400">${l.totalPrice.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-1">{MONTHS[month]} at a glance</p>
              <p className="text-xs text-gray-400 mb-4">Click any day to see its shoots.</p>
              {(() => {
                const monthListings = listings.filter((l) => {
                  const k = toDateKey(l.shootDate || l.preferredDate);
                  return k?.startsWith(monthPrefix);
                });
                const delivered = monthListings.filter((l) => l.gallery?.delivered).length;
                const revenue   = monthListings.reduce((s, l) => {
                  if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
                  if (l.depositPaid)                  return s + (l.depositAmount || 0);
                  return s;
                }, 0);
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Total shoots</span>
                      <span className="text-sm font-bold text-gray-900">{monthCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">Delivered</span>
                      <span className="text-sm font-semibold text-emerald-600">{delivered}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-gray-500">Revenue collected</span>
                      <span className="text-sm font-bold text-[#3486cf]">${revenue.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}
              {(() => {
                const monthDays = Object.entries(byDate)
                  .filter(([k]) => k.startsWith(monthPrefix))
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, 3);
                if (monthDays.length === 0) return null;
                return (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Busiest Days</p>
                    <div className="space-y-1.5">
                      {monthDays.map(([key, shoots]) => (
                        <button key={key} onClick={() => setSelected(key)}
                          className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          <span className="text-xs text-gray-700">
                            {new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                          <span className="text-xs font-semibold text-[#3486cf]">{shoots.length} shoot{shoots.length !== 1 ? "s" : ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "calendar");
  const [listings,  setListings]  = useState([]);
  const [blocks,    setBlocks]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const [listRes, blocksRes] = await Promise.all([
        fetch("/api/dashboard/listings", { headers }),
        fetch("/api/dashboard/team/blocks", { headers }),
      ]);
      if (listRes.ok)   { const d = await listRes.json();   setListings(d.listings || []); }
      if (blocksRes.ok) { const d = await blocksRes.json(); setBlocks(d.blocks || []); }
      setLoading(false);
    });
  }, []);

  function switchTab(id) {
    setActiveTab(id);
    router.replace(`/dashboard/calendar?tab=${id}`, { scroll: false });
  }

  return (
    <div className="max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-0">
        <div>
          <h1 className="page-title">Schedule</h1>
        </div>
        <Link href="/dashboard/bookings/create"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#3486cf] text-white hover:bg-[#2a6dab] transition-colors">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-6 pt-4 border-b border-gray-200">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => switchTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-[#3486cf] text-[#3486cf]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "calendar"    && <CalendarTab listings={listings} blocks={blocks} loading={loading} />}
      {activeTab === "unscheduled" && <UnscheduledTab listings={listings} />}
    </div>
  );
}
