"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

export default function CalendarPage() {
  const today = new Date();
  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth());  // 0-indexed
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // "YYYY-MM-DD" key of clicked day

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const res = await fetch("/api/dashboard/listings", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setListings(d.listings || []);
      }
      setLoading(false);
    });
  }, []);

  // Index listings by shoot date
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

  // Build calendar grid for current month
  const { cells, firstDay, daysInMonth } = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    // Leading empty cells
    for (let i = 0; i < firstDay; i++) cells.push(null);
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Trailing empty cells to fill last row
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells, firstDay, daysInMonth };
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
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(null);
  }

  function dayKey(d) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const selectedListings = selected ? (byDate[selected] || []) : [];

  // Count shoots this month for header
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthCount  = Object.entries(byDate).filter(([k]) => k.startsWith(monthPrefix)).reduce((s, [, v]) => s + v.length, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">
            {monthCount} shoot{monthCount !== 1 ? "s" : ""} in {MONTHS[month]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Today
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={prevMonth}
              className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-r border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-gray-900 min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth}
              className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-l border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <Link href="/dashboard/bookings/create"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#3486cf] text-white hover:bg-[#2a6dab] transition-colors">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Booking
          </Link>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map((d) => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Week rows */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) {
                  return (
                    <div key={`empty-${idx}`}
                      className="min-h-[96px] p-1.5 border-b border-r border-gray-50 bg-gray-50/40"
                      style={{ borderRight: (idx + 1) % 7 === 0 ? "none" : undefined }}
                    />
                  );
                }

                const key      = dayKey(day);
                const shoots   = byDate[key] || [];
                const isToday  = key === todayKey;
                const isSel    = key === selected;
                const isLast   = (idx + 1) % 7 === 0;
                const isLastRow = idx >= cells.length - 7;

                return (
                  <div
                    key={key}
                    onClick={() => setSelected(isSel ? null : key)}
                    className={`min-h-[96px] p-1.5 cursor-pointer transition-colors
                      ${isSel ? "bg-[#EEF5FC]" : "hover:bg-gray-50"}
                      ${isLastRow ? "" : "border-b border-gray-100"}
                      ${isLast ? "" : "border-r border-gray-100"}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                          ${isToday ? "bg-[#3486cf] text-white" : "text-gray-700"}
                        `}
                      >
                        {day}
                      </span>
                      {shoots.length > 2 && (
                        <span className="text-[10px] text-gray-400 font-medium">{shoots.length}</span>
                      )}
                    </div>

                    {/* Shoot chips — show up to 2, then "+N more" */}
                    <div className="space-y-0.5">
                      {shoots.slice(0, 2).map((l) => (
                        <Link
                          key={l.id}
                          href={`/dashboard/listings/${l.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block text-[10px] leading-tight px-1.5 py-0.5 rounded font-medium truncate text-white transition-opacity hover:opacity-80"
                          style={{ background: avatarColor(l.clientName || "") }}
                          title={`${l.clientName} · ${l.address?.split(",")[0]}`}
                        >
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
          </div>
        </div>

        {/* Day detail panel */}
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
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {MONTHS[month]} at a glance
              </p>
              <p className="text-xs text-gray-400 mb-4">Click any day to see its shoots.</p>

              {/* Month summary stats */}
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

              {/* Busiest days */}
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
