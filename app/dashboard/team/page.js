"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";
import { getAppUrl } from "@/lib/appUrl";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { avatarColor, initials } from "@/lib/avatar";
import { ZONE_COLORS } from "@/lib/zoneColors";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";
import { getEffectivePlan, getSeatLimit } from "@/lib/plans";
import { isDemo, getDemoTeam } from "@/lib/demoData";
import {
  ROLES as ROLE_DEFS, ROLE_IDS, DASHBOARD_ROLES, NON_SHOOTING,
  normalizeRole, defaultPermissions, roleLabel, shootsSchedule,
} from "@/lib/roles";

const ROLE_OPTIONS = ROLE_IDS.map((id) => ({
  id, label: ROLE_DEFS[id].label, icon: ROLE_DEFS[id].icon, desc: ROLE_DEFS[id].desc,
}));

const PERMISSION_DEFS = [
  { key: "canViewListings",   label: "Access Listings",        desc: "View and manage property listings" },
  { key: "canCreateBookings", label: "Access Bookings",        desc: "View and create bookings from the dashboard" },
  { key: "canViewRevenue",    label: "View Revenue & Pricing", desc: "See prices on bookings and listings, revenue stats, and the revenue chart" },
  { key: "canViewReports",    label: "View Reports",           desc: "Access the revenue reports page" },
  { key: "canManageTeam",     label: "Manage Team",            desc: "Add, edit, and remove team members" },
  { key: "canManageProducts", label: "Manage Products",        desc: "Create and edit services, packages, and add-ons" },
  { key: "canEditSettings",   label: "Edit Settings",          desc: "Change branding, availability, and booking settings" },
  { key: "canImportDropbox",  label: "Import from Dropbox",     desc: "Use the studio's connected Dropbox to import gallery media (off by default for security)" },
];

const DEFAULT_PERMISSIONS = Object.fromEntries(ROLE_IDS.map((id) => [id, { ...ROLE_DEFS[id].permissions }]));

const ROLE_COLORS = {
  photographer: { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-100" },
  manager:      { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
  admin:        { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-100" },
  custom:       { bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-200" },
};

const WEEK_DAYS = [
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
];

const DEFAULT_WORKING_HOURS = {
  sun: { enabled: false, start: "09:00", end: "17:00" },
  mon: { enabled: true,  start: "09:00", end: "17:00" },
  tue: { enabled: true,  start: "09:00", end: "17:00" },
  wed: { enabled: true,  start: "09:00", end: "17:00" },
  thu: { enabled: true,  start: "09:00", end: "17:00" },
  fri: { enabled: true,  start: "09:00", end: "17:00" },
  sat: { enabled: false, start: "09:00", end: "17:00" },
};

// ── Availability: compute a photographer's next open booking slot ─────────────
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function hmToMin(t) { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function minToLabel(min) {
  let h = Math.floor(min / 60); const m = min % 60;
  const ap = h < 12 ? "AM" : "PM"; let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
function ymdLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// Returns the next free slot { day:Date, min } within the member's working hours
// over the next 21 days, skipping booked times and time blocks. null if booked out.
function nextAvailableSlot(member, bookings, timeBlocks, slotMin = 60) {
  const wh = member.workingHours || DEFAULT_WORKING_HOURS;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let d = 0; d < 21; d++) {
    const day = new Date(now); day.setDate(now.getDate() + d);
    const cfg = wh[DOW_KEYS[day.getDay()]];
    if (!cfg || !cfg.enabled) continue;
    const dateStr  = ymdLocal(day);
    const startMin = hmToMin(cfg.start || "09:00");
    const endMin   = hmToMin(cfg.end   || "17:00");
    const taken = bookings
      .filter((b) => b.photographerId === member.id && b.shootDate === dateStr && b.shootTime)
      .map((b) => hmToMin(b.shootTime));
    const blocks = (timeBlocks || []).filter((tb) => {
      // Whose block: this member's, or a team-wide block (no member set).
      if (!(!tb.memberId || tb.memberId === member.id || tb.photographerId === member.id)) return false;
      // Which day(s): handle both synced (startDate/endDate or ISO startTime)
      // and manual (date / startDate) blocks. A dateless block applies daily.
      const sStr = blockDateStr(tb, "start") || tb.date || "";
      const eStr = blockDateStr(tb, "end")   || tb.date || sStr;
      if (!sStr) return true;
      return dateStr >= sStr && dateStr <= eStr;
    });
    for (let s = startMin; s + slotMin <= endMin; s += slotMin) {
      if (d === 0 && s <= nowMin) continue;
      if (taken.some((t) => t >= s && t < s + slotMin)) continue;
      const blocked = blocks.some((tb) => {
        // All-day (or whole-day) blocks cover the entire working window.
        if (tb.allDay !== false && !tb.startTime && !tb.start) return true;
        const bs = blockMin(tb, "start", startMin);
        const be = blockMin(tb, "end",   endMin);
        return s < be && s + slotMin > bs;
      });
      if (blocked) continue;
      return { day, min: s };
    }
  }
  return null;
}
function formatSlot(slot) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const d0 = new Date(slot.day.getFullYear(), slot.day.getMonth(), slot.day.getDate());
  const diff = Math.round((d0 - t0) / 86400000);
  const dlabel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${DAYS_SHORT[slot.day.getDay()]} ${slot.day.getMonth() + 1}/${slot.day.getDate()}`;
  return `${dlabel} · ${minToLabel(slot.min)}`;
}

const SKILL_LABELS = {
  classicDaytime:         "Classic Daytime",
  luxuryDaytime:          "Luxury Daytime",
  drone:                  "Drone",
  realTwilight:           "Twilight",
  premiumCinematicVideo:  "Cinematic Video",
  luxuryCinematicVideo:   "Luxury Video",
  socialReel:             "Social Reel",
  matterport:             "Matterport",
  zillow3d:               "Zillow 3D",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COLORS     = ["#0b2a55","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#827717","#ad1457"];

function fmt12(time) {
  if (!time) return "";
  // Synced calendar blocks (Google/Apple/Outlook) store a full ISO datetime in
  // startTime/endTime, while manual blocks store plain "HH:MM". Handle both so
  // synced event start/finish times always display (and stay accurate).
  if (typeof time === "string" && (time.includes("T") || time.length > 5)) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }
  const [h, m] = String(time).split(":");
  const hr = Number(h);
  if (isNaN(hr)) return "";
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

// Date (YYYY-MM-DD) a block falls on, in the VIEWER's local timezone. Synced
// blocks store startDate as a UTC date but startTime as a full ISO datetime;
// bucketing by the UTC date shifts evening/edge events to the wrong day. We
// recompute from the ISO so the day matches what the user sees in Google (and
// matches the time we display, which is also local).
function blockDateStr(bl, which) {
  const iso = which === "end" ? bl.endTime : bl.startTime;
  if (bl.source === "google" && iso && typeof iso === "string" && iso.includes("T")) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  const fallback = which === "end" ? (bl.endDate || bl.startDate || "") : (bl.startDate || "");
  return fallback.slice(0, 10);
}

// Minutes-since-midnight for a block's start/end, handling synced ISO datetimes
// (startTime/endTime), manual "HH:MM" (start/end), or a fallback when absent.
function blockMin(tb, which, fallback) {
  const t = which === "end" ? (tb.endTime || tb.end) : (tb.startTime || tb.start);
  if (!t) return fallback;
  if (typeof t === "string" && (t.includes("T") || t.length > 5)) {
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  return hmToMin(t);
}

// Label for a block in the grid. Synced calendar blocks get the member's first
// name prefixed (e.g. "James · Busy") so it's clear whose calendar it's from.
function blockLabel(bl, member) {
  const base = bl.reason || "Busy";
  const first = member?.name ? member.name.split(" ")[0] : "";
  if (bl.source === "google" && first) return `${first} · ${base}`;
  return base;
}

function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getWeekDates(anchor) {
  const d = new Date(anchor);
  d.setHours(0,0,0,0);
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function toDateKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
}

// ─── Booking Calendar tab (merged from /dashboard/calendar) ──────────────────
function BookingCalendarTab({ listings, loading }) {
  const today = new Date();
  const [year,     setYear]     = useState(today.getFullYear());
  const [month,    setMonth]    = useState(today.getMonth());
  const [selected, setSelected] = useState(null);

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

  const cells = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); }
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); }
    setSelected(null);
  }
  function goTodayBCT() { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null); }

  function dayKey(d) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const todayKey    = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthCount  = Object.entries(byDate).filter(([k]) => k.startsWith(monthPrefix)).reduce((s, [, v]) => s + v.length, 0);
  const selectedListings = selected ? (byDate[selected] || []) : [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-400">
          {monthCount} shoot{monthCount !== 1 ? "s" : ""} in {MONTHS[month]} {year}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={goTodayBCT}
            className="text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Today
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={prevMonth} className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-r border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-gray-900 min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="px-3 py-2 hover:bg-gray-50 transition-colors text-gray-500 border-l border-gray-200">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return (
                  <div key={`empty-${idx}`}
                    className="min-h-[96px] p-1.5 border-b border-r border-gray-50 bg-gray-50/40"
                    style={{ borderRight: (idx + 1) % 7 === 0 ? "none" : undefined }} />
                );
                const key     = dayKey(day);
                const shoots  = byDate[key] || [];
                const isToday = key === todayKey;
                const isSel   = key === selected;
                const isLast  = (idx + 1) % 7 === 0;
                const isLastRow = idx >= cells.length - 7;
                return (
                  <div key={key}
                    onClick={() => setSelected(isSel ? null : key)}
                    className={`min-h-[96px] p-1.5 cursor-pointer transition-colors
                      ${isSel ? "bg-[#EEF5FC]" : "hover:bg-gray-50"}
                      ${isLastRow ? "" : "border-b border-gray-100"}
                      ${isLast ? "" : "border-r border-gray-100"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                        ${isToday ? "bg-[#3486cf] text-white" : "text-gray-700"}`}>{day}</span>
                      {shoots.length > 2 && <span className="text-[10px] text-gray-400 font-medium">{shoots.length}</span>}
                    </div>
                    <div className="space-y-0.5">
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
          </div>
        </div>

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

// ─── Booking Unscheduled tab (merged from /dashboard/calendar) ────────────────
function BookingUnscheduledTab({ listings }) {
  const active      = listings.filter((l) => l.status !== "cancelled");
  const unscheduled = active.filter((l) => !l.shootDate && !l.preferredDate);
  const noDate      = active.filter((l) => l.preferredDate && !l.shootDate);

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

// ─── Member form modal ────────────────────────────────────────────────────────
const MEMBER_TABS = [
  { id: "info",     label: "Info" },
  { id: "services", label: "Services" },
  { id: "pay",      label: "Pay & Hours" },
  { id: "access",   label: "Access" },
];

function MemberForm({ member, products, onSave, onDelete, onClose }) {
  const initialRole = normalizeRole(member?.role);
  const [tab, setTab] = useState("info");
  const [form, setForm] = useState({
    name:          member?.name          || "",
    email:         member?.email         || "",
    phone:         member?.phone         || "",
    homeZip:       member?.homeZip       || "",
    role:          initialRole,
    customRoleTitle: member?.customRoleTitle || "",
    skills:        member?.skills        || [],
    color:         member?.color         || COLORS[0],
    active:        member?.active        !== false,
    payRate:       member?.payRate       ?? "",
    serviceRates:  member?.serviceRates  || {},
    bufferMinutes: member?.bufferMinutes ?? "",
    workingHours:  member?.workingHours  || DEFAULT_WORKING_HOURS,
    permissions:   member?.permissions   || { ...DEFAULT_PERMISSIONS[initialRole] },
    // Whether this member appears in the photographer picker on bookings.
    // Only photographers shoot by default; managers/admins/custom default off.
    showInScheduling: member?.showInScheduling ?? (initialRole === "photographer"),
    photoUrl:      member?.photoUrl      || "",
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoFile(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { auth: fbAuth } = await import("@/lib/firebase");
      const token = await fbAuth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, folder: "team-photos" }),
      });
      if (!res.ok) return;
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setForm((f) => ({ ...f, photoUrl: publicUrl }));
    } catch { /* ignore */ }
    finally { setUploadingPhoto(false); }
  }

  function toggleSkill(s) {
    setForm((f) => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s] }));
  }

  const allProducts = [
    ...(products.services || []),
    ...(products.packages || []),
    ...(products.addons   || []),
  ].filter((p) => p.active !== false);

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm("Remove this team member?")) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#0F172A] text-base">{member ? "Edit Team Member" : "Add Team Member"}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
          </div>
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 -mx-6 px-6">
            {MEMBER_TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.id ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── INFO ── */}
          {tab === "info" && (
            <>
              <div>
                <label className="label-field">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button key={r.id} type="button" onClick={() => setForm((f) => ({
                      ...f, role: r.id, permissions: { ...DEFAULT_PERMISSIONS[r.id] },
                      showInScheduling: r.id === "photographer",
                    }))}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        form.role === r.id ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="text-lg leading-none">{r.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0F172A]">{r.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {form.role === "custom" && (
                  <div className="mt-3">
                    <label className="label-field">Custom role title</label>
                    <input
                      type="text"
                      value={form.customRoleTitle}
                      onChange={(e) => setForm((f) => ({ ...f, customRoleTitle: e.target.value.slice(0, 40) }))}
                      placeholder="e.g. Coordinator, Editor, Office Manager"
                      className="input-field w-full" />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Shown on the team list and schedule. Set exactly which permissions apply below.
                    </p>
                  </div>
                )}
              </div>

              {/* Profile photo */}
              <div className="flex items-center gap-3">
                {form.photoUrl
                  ? <img src={form.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" />
                  : <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: form.color || "#3486cf" }}>{(form.name?.[0] || "?").toUpperCase()}</div>}
                <div className="flex-1">
                  <label className="label-field">Profile Photo</label>
                  <div className="flex items-center gap-2">
                    <label className="btn-outline px-3 py-1.5 text-xs cursor-pointer">
                      {uploadingPhoto ? "Uploading…" : form.photoUrl ? "Change" : "Upload photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={(e) => handlePhotoFile(e.target.files?.[0])} disabled={uploadingPhoto} />
                    </label>
                    {form.photoUrl && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))}
                        className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-field">Full Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
                    className="input-field w-full" placeholder="Alex Johnson" />
                </div>
                <div>
                  <label className="label-field">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({...f, email: e.target.value}))}
                    className="input-field w-full" placeholder="alex@example.com" />
                </div>
                <div>
                  <label className="label-field">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({...f, phone: e.target.value}))}
                    className="input-field w-full" placeholder="(619) 555-0100" />
                </div>
                <div>
                  <label className="label-field">Home ZIP</label>
                  <input type="text" value={form.homeZip} maxLength={5}
                    onChange={(e) => setForm((f) => ({...f, homeZip: e.target.value}))}
                    className="input-field w-full" placeholder="92108" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Used for travel fee calculations</p>
                </div>
              </div>

              <div>
                <label className="label-field">Calendar Color</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm((f) => ({...f, color: c}))}
                      style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-all flex-shrink-0 ${form.color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""}`} />
                  ))}
                  <label title="Custom color"
                    className={`w-7 h-7 rounded-full flex-shrink-0 border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden transition-all ${
                      !COLORS.includes(form.color) ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : "border-gray-300 hover:border-gray-500"
                    }`}
                    style={!COLORS.includes(form.color) ? { background: form.color } : {}}>
                    <input type="color" value={form.color}
                      onChange={(e) => setForm((f) => ({...f, color: e.target.value}))}
                      className="opacity-0 absolute w-px h-px" />
                    {COLORS.includes(form.color) && <span className="text-gray-400 text-[10px] leading-none select-none">+</span>}
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="member-active" checked={form.active}
                  onChange={(e) => setForm((f) => ({...f, active: e.target.checked}))} />
                <label htmlFor="member-active" className="text-sm text-[#0F172A] cursor-pointer">Active — visible on schedule</label>
              </div>
            </>
          )}

          {/* ── SERVICES ── */}
          {tab === "services" && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Select which products/services this team member can perform. Leave blank to allow all.</p>
                {allProducts.length > 0 && (
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <button type="button"
                      onClick={() => setForm((f) => ({ ...f, skills: allProducts.map((p) => p.id) }))}
                      className="text-xs font-medium text-[#3486cf] hover:underline whitespace-nowrap">
                      Select all
                    </button>
                    {form.skills.length > 0 && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, skills: [] }))}
                        className="text-xs text-gray-400 hover:text-red-500 whitespace-nowrap">Clear all</button>
                    )}
                  </div>
                )}
              </div>
              {allProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Add products first in the Products page.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                  {allProducts.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.skills.includes(p.id)}
                        onChange={() => toggleSkill(p.id)}
                        className="rounded border-gray-300 text-[#3486cf]"
                      />
                      <span className="text-sm text-[#0F172A] flex-1">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {form.skills.length > 0 && (
                <p className="text-xs font-medium text-gray-500 mt-1">{form.skills.length} of {allProducts.length} service{allProducts.length !== 1 ? "s" : ""} assigned</p>
              )}
            </>
          )}

          {/* ── PAY & HOURS ── */}
          {tab === "pay" && (
            <>
              <div>
                <label className="label-field">Default Pay Rate ($ per shoot)</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.payRate}
                    onChange={(e) => setForm((f) => ({...f, payRate: e.target.value === "" ? "" : parseFloat(e.target.value)}))}
                    className="input-field w-36" placeholder="150" />
                  <span className="text-xs text-gray-400">per booking</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Shown in their photographer portal.</p>
              </div>

              {form.skills.length > 0 && (
                <div>
                  <label className="label-field">Per-Service Rates (optional)</label>
                  <p className="text-xs text-gray-400 mb-2">Override the default rate for specific services.</p>
                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {form.skills.map((skillId) => {
                      const product = allProducts.find((p) => p.id === skillId);
                      if (!product) return null;
                      const hasTiers = product.priceTiers && Object.values(product.priceTiers).some((v) => v > 0);
                      return (
                        <div key={skillId} className="px-3 py-2.5">
                          <p className="text-xs font-semibold text-[#0F172A] mb-1.5">{product.name}</p>
                          {hasTiers ? (
                            <div className="grid grid-cols-3 gap-2">
                              {Object.keys(product.priceTiers).map((tier) => (
                                <div key={tier}>
                                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-0.5">{tier}</label>
                                  <input type="number" min="0" step="1" placeholder={String(form.payRate || "")}
                                    value={form.serviceRates?.[skillId]?.[tier] ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                                      setForm((f) => ({
                                        ...f,
                                        serviceRates: { ...f.serviceRates, [skillId]: { ...(f.serviceRates?.[skillId] || {}), [tier]: val } },
                                      }));
                                    }}
                                    className="input-field w-full text-xs py-1.5 px-2" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">$</span>
                              <input type="number" min="0" step="1" placeholder={String(form.payRate || "Default")}
                                value={typeof form.serviceRates?.[skillId] === "number" ? form.serviceRates[skillId] : ""}
                                onChange={(e) => setForm((f) => ({
                                  ...f,
                                  serviceRates: { ...f.serviceRates, [skillId]: e.target.value === "" ? undefined : Number(e.target.value) },
                                }))}
                                className="input-field w-32 text-xs py-1.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="label-field">Booking Buffer <span className="font-normal text-gray-400">(extra time after each shoot)</span></label>
                <select value={form.bufferMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, bufferMinutes: e.target.value === "" ? "" : Number(e.target.value) }))}
                  className="input-field w-full">
                  <option value="">Default (no extra buffer)</option>
                  <option value={15}>+15 min</option>
                  <option value={30}>+30 min</option>
                  <option value={45}>+45 min</option>
                  <option value={60}>+60 min</option>
                  <option value={90}>+90 min</option>
                </select>
              </div>

              <div>
                <label className="label-field">Working Hours</label>
                <p className="text-xs text-gray-400 mb-2">Days and times this person is available to be scheduled.</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {WEEK_DAYS.map(({ key, label }) => {
                    const day = form.workingHours?.[key] || { enabled: false, start: "09:00", end: "17:00" };
                    return (
                      <div key={key} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
                        <span className="w-8 text-xs font-medium text-gray-500 flex-shrink-0">{label}</span>
                        <input type="checkbox" checked={!!day.enabled}
                          onChange={(e) => setForm((f) => ({
                            ...f,
                            workingHours: { ...f.workingHours, [key]: { ...day, enabled: e.target.checked } },
                          }))} />
                        {day.enabled ? (
                          <>
                            <input type="time" value={day.start || "09:00"}
                              onChange={(e) => setForm((f) => ({
                                ...f,
                                workingHours: { ...f.workingHours, [key]: { ...day, start: e.target.value } },
                              }))}
                              className="input-field text-xs py-1 px-2 w-28 flex-shrink-0" />
                            <span className="text-xs text-gray-400">—</span>
                            <input type="time" value={day.end || "17:00"}
                              onChange={(e) => setForm((f) => ({
                                ...f,
                                workingHours: { ...f.workingHours, [key]: { ...day, end: e.target.value } },
                              }))}
                              className="input-field text-xs py-1 px-2 w-28 flex-shrink-0" />
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── ACCESS ── */}
          {tab === "access" && (
            <>
              {/* Photographer scheduling toggle — the most important, decoupled
                  from dashboard permissions so it's never confusing. */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-[#3486cf]/20 bg-[#3486cf]/5 mb-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F172A]">Show in photographer selection</p>
                  <p className="text-[11px] text-gray-500">When on, this person can be assigned as the photographer on bookings and appears in the schedule.</p>
                </div>
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, showInScheduling: !f.showInScheduling }))}
                  className={`relative inline-flex w-9 h-5 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${form.showInScheduling ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                  <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${form.showInScheduling ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                Dashboard permissions below control what this member can see and do when they log in. Defaults are set by role — photographers usually have none of these.
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dashboard Permissions</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {PERMISSION_DEFS.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A]">{label}</p>
                        <p className="text-[11px] text-gray-400">{desc}</p>
                      </div>
                      <button type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          permissions: { ...f.permissions, [key]: !f.permissions[key] },
                        }))}
                        className={`relative inline-flex w-9 h-5 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                          form.permissions[key] ? "bg-[#3486cf]" : "bg-gray-200"
                        }`}>
                        <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          form.permissions[key] ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {member
            ? <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
                {deleting ? "Removing…" : "Remove member"}
              </button>
            : <div />
          }
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary px-6 py-2 text-sm">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Owner Calendar Sync Modal ────────────────────────────────────────────────
function OwnerCalSyncModal({ tenant, onClose, onConnected }) {
  const APP_URL = getAppUrl();
  const isGCalConnected = !!tenant?.ownerGoogleCalendar?.refreshToken;

  const [connecting,    setConnecting]    = useState(false);
  const [connectError,  setConnectError]  = useState("");
  const [syncing,       setSyncing]       = useState(false);
  const [syncResult,    setSyncResult]    = useState(null);
  const [lastSynced,    setLastSynced]    = useState(tenant?.ownerGoogleCalendar?.lastSynced || null);
  const [calToken,      setCalToken]      = useState(tenant?.ownerCalendarToken || null);
  const [tokenLoading,  setTokenLoading]  = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(isGCalConnected);
  const [calIdInput,    setCalIdInput]    = useState(tenant?.ownerGoogleCalendar?.calendarId && tenant.ownerGoogleCalendar.calendarId !== "primary" ? tenant.ownerGoogleCalendar.calendarId : "");
  const [savingCalId,   setSavingCalId]   = useState(false);
  const [currentCalId,  setCurrentCalId]  = useState(tenant?.ownerGoogleCalendar?.calendarId || "primary");

  useEffect(() => {
    if (calToken) return;
    setTokenLoading(true);
    (async () => {
      try {
        const { auth: firebaseAuth } = await import("@/lib/firebase");
        const idToken = await firebaseAuth.currentUser.getIdToken();
        const res = await fetch("/api/calendar/owner/token", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const d = await res.json();
          setCalToken(d.token);
        }
      } catch { /* non-fatal */ }
      finally { setTokenLoading(false); }
    })();
  }, []);

  async function connectGoogle() {
    setConnecting(true);
    setConnectError("");
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const idToken = await firebaseAuth.currentUser.getIdToken();
      const popup = window.open(
        `/api/calendar/oauth/start?token=${encodeURIComponent(idToken)}&owner=1`,
        "gcal-oauth",
        "width=500,height=620,left=200,top=100"
      );
      if (!popup) {
        throw new Error("Popup blocked. Allow popups for this site, then try again.");
      }
      await new Promise((resolve, reject) => {
        let poll;
        const cleanup = () => { clearInterval(poll); window.removeEventListener("message", handler); };
        const handler = (e) => {
          if (e.data?.type === "gcal-connected") { cleanup(); resolve(); }
          if (e.data?.type === "gcal-error")     { cleanup(); reject(new Error(e.data.error || "Connection failed")); }
        };
        window.addEventListener("message", handler);
        poll = setInterval(() => {
          if (popup.closed) { cleanup(); resolve(); }
        }, 600);
      });
      // Refresh tenant first so the modal reflects the new connection, THEN flag
      // connected — prevents the UI flicker that looked like a reset.
      await onConnected?.();
      setGcalConnected(true);
    } catch (e) {
      setConnectError(e.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    setConnectError("");
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const idToken = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: "__owner__" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setConnectError(d.error || `Sync failed (${res.status})`); return; }
      setSyncResult(d.synced);
      setLastSynced(new Date().toISOString());
      window.dispatchEvent(new CustomEvent("kyoria:blocks-updated"));
      try { localStorage.setItem("kyoria_blocks_ts", Date.now().toString()); } catch {}
    } catch (e) {
      setConnectError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectGcal() {
    if (!confirm("Disconnect your Google Calendar? All synced busy blocks will be removed.")) return;
    setDisconnecting(true);
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const idToken = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: "__owner__" }),
      });
      if (res.ok) {
        setGcalConnected(false);
        setSyncResult(null);
        setLastSynced(null);
      } else {
        const d = await res.json();
        setConnectError(d.error || "Disconnect failed");
      }
    } catch (e) {
      setConnectError(e.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function saveCalendarId() {
    setSavingCalId(true);
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const idToken = await firebaseAuth.currentUser.getIdToken();
      const id = calIdInput.trim() || "primary";
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: "__owner__", calendarId: id }),
      });
      if (res.ok) {
        setCurrentCalId(id);
        setConnectError("");
      } else {
        const d = await res.json();
        setConnectError(d.error || "Failed to save calendar ID");
      }
    } catch (e) { setConnectError(e.message); }
    setSavingCalId(false);
  }

  const feedUrl    = calToken ? `${APP_URL}/api/calendar/owner/${calToken}` : null;
  const webcalUrl  = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;
  const gcalUrl    = feedUrl ? `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}` : null;
  const outlookUrl = feedUrl ? `https://outlook.live.com/owa/?path=/calendar/action/compose&rru=addsubscription&url=${encodeURIComponent(feedUrl)}` : null;

  function copyLink() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-[#0F172A] text-base">Your Calendar Sync</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Google Calendar */}
          {gcalConnected ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-green-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Google Calendar connected</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : "Not yet synced"}
                    </p>
                    {syncResult !== null && (
                      <p className="text-xs text-green-600 font-medium mt-1">{syncResult} busy block{syncResult !== 1 ? "s" : ""} imported</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={syncNow} disabled={syncing}
                    className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium">
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>
                  <button onClick={disconnectGcal} disabled={disconnecting}
                    className="text-xs bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium">
                    {disconnecting ? "Removing…" : "Disconnect"}
                  </button>
                </div>
              </div>
              {connectError && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{connectError}</div>
              )}
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs font-semibold text-green-800 mb-1.5">Which calendar to sync</p>
                <p className="text-[11px] text-green-700 mb-2 leading-relaxed">
                  By default your primary calendar is synced. Paste a Calendar ID to sync a specific calendar —
                  find it in Google Calendar › Settings › [Calendar name] › Integrate calendar.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={calIdInput}
                    onChange={(e) => setCalIdInput(e.target.value)}
                    placeholder="primary (default) or paste calendar ID"
                    className="input-field flex-1 text-xs py-1.5"
                  />
                  <button onClick={saveCalendarId} disabled={savingCalId}
                    className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium flex-shrink-0">
                    {savingCalId ? "Saving…" : "Save"}
                  </button>
                </div>
                {currentCalId !== "primary" && (
                  <p className="text-[11px] text-green-700 mt-1">Currently syncing: {currentCalId}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#4285F4"/><path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/><path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Google Calendar</p>
                  <p className="text-xs text-gray-500">Block your busy times automatically in your booking schedule.</p>
                </div>
              </div>
              {/* How it works */}
              <div className="rounded-lg bg-[#3486cf]/5 border border-[#3486cf]/15 p-3 text-[11px] text-[#1E5A8A] leading-relaxed">
                <p className="font-semibold mb-1">How it works</p>
                <ol className="list-decimal ml-4 space-y-0.5">
                  <li>Connect your Google account (we only read your busy/free times — never event details).</li>
                  <li>Your busy times for the next 90 days appear as &quot;Busy&quot; blocks on your schedule.</li>
                  <li>Those blocks stop you being double-booked when assigning shoots.</li>
                  <li>It re-syncs automatically; hit <strong>Sync Now</strong> anytime to refresh immediately.</li>
                </ol>
              </div>
              <button onClick={connectGoogle} disabled={connecting}
                className="w-full flex items-center justify-center gap-2 border border-[#3486cf]/30 text-[#3486cf] text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#3486cf]/5 disabled:opacity-50 transition-colors">
                {connecting ? "Opening…" : "Connect Google Calendar"}
              </button>
              {connectError && <p className="text-xs text-red-600">{connectError}</p>}
            </div>
          )}

          {/* Subscribe to schedule (Apple, Outlook, Google) */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Subscribe to Your Schedule</p>
              <p className="text-xs text-gray-500 mt-0.5">Add your full shoot calendar to Apple Calendar, Google Calendar, or Outlook. Updates automatically.</p>
            </div>
            {tokenLoading ? (
              <p className="text-xs text-gray-400">Generating feed link…</p>
            ) : feedUrl ? (
              <>
                <div className="flex gap-2 items-center">
                  <code className="text-[11px] bg-gray-50 border border-gray-200 rounded px-3 py-2 flex-1 truncate text-gray-600">{feedUrl}</code>
                  <button onClick={copyLink}
                    className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2.5 py-2 rounded hover:bg-[#3486cf]/5 flex-shrink-0">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#4285F4"/><path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/><path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/></svg>
                    Google
                  </a>
                  <a href={webcalUrl}
                    className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#1c1c1e"/><rect x="4" y="5" width="16" height="15" rx="1.5" fill="white"/><rect x="4" y="5" width="16" height="4" rx="1.5" fill="#F44336"/><path d="M8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 16h2v2H8v-2zm3 0h2v2h-2v-2z" fill="#1c1c1e"/></svg>
                    Apple
                  </a>
                  <a href={outlookUrl} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#0078d4"/><rect x="4" y="6" width="16" height="12" rx="1" fill="white"/><path d="M4 9l8 5 8-5" stroke="#0078d4" strokeWidth="1.5"/></svg>
                    Outlook
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end sticky bottom-0 bg-white" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="btn-outline px-5 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar sync modal — admin read-only status view ───────────────────────
function CalendarSyncModal({ member, onClose, onRegenerate, onDisconnect }) {
  const APP_URL = getAppUrl();
  const isGCalConnected = !!member.googleCalendar?.refreshToken;

  const [syncError,      setSyncError]      = useState("");
  const [syncing,        setSyncing]        = useState(false);
  const [syncResult,     setSyncResult]     = useState(null);
  const [lastSynced,     setLastSynced]     = useState(member.googleCalendar?.lastSynced || null);
  const [disconnecting,  setDisconnecting]  = useState(false);
  const [calendarId,     setCalendarId]     = useState(member.googleCalendar?.calendarId || "primary");
  const [savingCalId,    setSavingCalId]    = useState(false);
  const [calIdSaved,     setCalIdSaved]     = useState(false);
  const [syncEnabled,    setSyncEnabled]    = useState(member.googleCalendar?.syncEnabled !== false);

  async function toggleSyncEnabled() {
    const next = !syncEnabled;
    setSyncEnabled(next);
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser.getIdToken();
      await fetch("/api/dashboard/team/google-sync", {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: member.id, syncEnabled: next }),
      });
    } catch { setSyncEnabled(!next); }
  }

  async function saveCalendarId() {
    setSavingCalId(true); setCalIdSaved(false); setSyncError("");
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: member.id, calendarId: calendarId.trim() || "primary" }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSyncError(d.error || "Couldn't save calendar"); return; }
      setCalIdSaved(true);
      setTimeout(() => setCalIdSaved(false), 2000);
    } catch (e) { setSyncError(e.message); }
    finally { setSavingCalId(false); }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: member.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSyncError(d.error || `Sync failed (${res.status})`); return; }
      setSyncResult(d.synced);
      setLastSynced(new Date().toISOString());
      window.dispatchEvent(new CustomEvent("kyoria:blocks-updated"));
      try { localStorage.setItem("kyoria_blocks_ts", Date.now().toString()); } catch {}
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectGcal() {
    if (!confirm(`Disconnect Google Calendar for ${member.name}? All synced busy blocks will be removed.`)) return;
    setDisconnecting(true);
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/team/google-sync", {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ memberId: member.id }),
      });
      if (res.ok) {
        onDisconnect?.(member.id);
        onClose();
      } else {
        const d = await res.json();
        setSyncError(d.error || "Disconnect failed");
      }
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setDisconnecting(false);
    }
  }

  const feedUrl    = member.calendarToken ? `${APP_URL}/api/calendar/${member.calendarToken}` : null;
  const webcalUrl  = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;
  const gcalUrl    = feedUrl ? `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}` : null;
  const outlookUrl = feedUrl ? `https://outlook.live.com/owa/?path=/calendar/action/compose&rru=addsubscription&url=${encodeURIComponent(feedUrl)}` : null;

  const [copied, setCopied] = useState(false);
  function copyLink() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-[#0F172A] text-base">Calendar Sync — {member.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-6 space-y-4">

          {/* Connection status */}
          {isGCalConnected ? (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-green-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Google Calendar connected</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {lastSynced
                        ? `Last synced ${new Date(lastSynced).toLocaleString()}`
                        : "Not yet synced"}
                    </p>
                    {syncResult !== null && (
                      <p className="text-xs text-green-600 font-medium mt-1">{syncResult} busy block{syncResult !== 1 ? "s" : ""} imported</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={syncNow}
                    disabled={syncing}
                    className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium">
                    {syncing ? "Syncing…" : "Sync Now"}
                  </button>
                  <button
                    onClick={disconnectGcal}
                    disabled={disconnecting}
                    className="text-xs bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium">
                    {disconnecting ? "Removing…" : "Disconnect"}
                  </button>
                </div>
              </div>
              {syncError && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {syncError}
                </div>
              )}

              {/* What gets synced — explanation */}
              <div className="mt-3 pt-3 border-t border-green-200/60">
                <p className="text-[11px] text-green-700 leading-relaxed">
                  <strong>What syncs:</strong> events from {member.name}&apos;s Google Calendar for the next 90 days
                  are imported as unavailable blocks (with their title &amp; time). Events marked &quot;Free&quot; or declined
                  are ignored. Syncs run automatically; use <strong>Sync Now</strong> to refresh immediately.
                </p>
                {/* Admin: turn this member's calendar events on/off without disconnecting them. */}
                <label className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-green-200/60 cursor-pointer">
                  <span className="text-[11px] text-green-800 font-medium">{syncEnabled ? "Calendar events are ON for this member" : "Calendar events are OFF (ignored in scheduling)"}</span>
                  <button type="button" onClick={toggleSyncEnabled}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${syncEnabled ? "bg-green-600" : "bg-gray-300"}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${syncEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </button>
                </label>
              </div>

              {/* Specific calendar selection */}
              <div className="mt-3 pt-3 border-t border-green-200/60">
                <label className="text-[11px] font-semibold text-green-800 block mb-1">Calendar to sync</label>
                <div className="flex gap-2 items-center">
                  <input
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    placeholder="primary"
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-green-300 bg-white text-gray-700" />
                  <button onClick={saveCalendarId} disabled={savingCalId}
                    className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium flex-shrink-0">
                    {savingCalId ? "Saving…" : calIdSaved ? "Saved ✓" : "Save"}
                  </button>
                </div>
                <p className="text-[10px] text-green-600 mt-1 leading-relaxed">
                  Leave as <strong>primary</strong> for the main calendar. To sync a different one, open Google Calendar →
                  the calendar&apos;s <strong>Settings → Integrate calendar → Calendar ID</strong> (e.g.
                  <span className="font-mono"> abc123@group.calendar.google.com</span>) and paste it here, then Sync Now.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Not connected</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {member.name} hasn&apos;t connected their Google Calendar yet. Each team member connects their own account from their personal <strong>My Profile</strong> page.
                </p>
              </div>
            </div>
          )}

          {/* ICS feed */}
          {feedUrl && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600">Subscribe to Schedule</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Read-only feed for Apple Calendar, Google Calendar, or Outlook</p>
              </div>
              <div className="flex gap-2 items-center">
                <code className="text-[11px] bg-gray-50 border border-gray-200 rounded px-3 py-2 flex-1 truncate text-gray-600">
                  {feedUrl}
                </code>
                <button onClick={copyLink}
                  className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2.5 py-2 rounded hover:bg-[#3486cf]/5 flex-shrink-0">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#4285F4"/><path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/><path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/></svg>
                  Google
                </a>
                <a href={webcalUrl}
                  className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#1c1c1e"/><rect x="4" y="5" width="16" height="15" rx="1.5" fill="white"/><rect x="4" y="5" width="16" height="4" rx="1.5" fill="#F44336"/><path d="M8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 16h2v2H8v-2zm3 0h2v2h-2v-2z" fill="#1c1c1e"/></svg>
                  Apple
                </a>
                <a href={outlookUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 border border-gray-200 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600 text-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="2" fill="#0078d4"/><rect x="4" y="6" width="16" height="12" rx="1" fill="white"/><path d="M4 9l8 5 8-5" stroke="#0078d4" strokeWidth="1.5"/></svg>
                  Outlook
                </a>
              </div>
              <div className="pt-1 border-t border-gray-100">
                <button onClick={onRegenerate} className="text-xs text-red-400 hover:text-red-600">
                  Regenerate link
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-4 flex justify-end sticky bottom-0 bg-white" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="btn-outline px-5 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Detail Popover (Google-Calendar-style click-to-expand) ─────────────
function EventDetailPopover({ event, members, onClose }) {
  const member = members.find((m) => m.id === event.photographerId);
  const color  = event.memberColor || member?.color || "#3486cf";

  const displayDate = event.shootDate || event.preferredDate;
  const displayTime = event.shootTime || event.preferredTime;

  const dateLabel = displayDate
    ? new Date(displayDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  const timeLabel = displayTime && !["flexible","morning","afternoon","evening","twilight"].includes(displayTime?.toLowerCase())
    ? displayTime
    : displayTime
      ? displayTime.charAt(0).toUpperCase() + displayTime.slice(1)
      : null;

  const ws = resolveWorkflowStatus(event);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Photographer color bar */}
        <div className="h-1.5" style={{ background: color }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{event.fullAddress || event.address}</p>
              {event.clientName && <p className="text-xs text-gray-500 mt-0.5">{event.clientName}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg leading-none flex-shrink-0">×</button>
          </div>

          <div className="space-y-2">
            {dateLabel && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}</span>
              </div>
            )}

            {(member || event.photographerName) && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span>{member?.name || event.photographerName}</span>
              </div>
            )}

            {ws && (
              <div className="pt-0.5">
                <WorkflowStatusBadge status={ws} />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Link href={`/dashboard/bookings/${event.id}`}
              className="flex-1 text-center text-xs font-semibold bg-[#3486cf] text-white py-2 px-3 rounded-lg hover:bg-[#2a6eb5] transition-colors">
              Open Booking
            </Link>
            <button onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-700 py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Block Time Modal ─────────────────────────────────────────────────────────
const BLOCK_REASONS = ["Vacation", "Day Off", "Personal", "Holiday", "Sick Day", "Other"];
const TIME_OPTIONS = (() => {
  const out = [];
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return out;
})();
function fmtTimeOpt(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function BlockTimeModal({ members, onSave, onClose, timeBlocks, onDeleteBlock }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    memberId:   "",
    startDate:  today,
    endDate:    today,
    startTime:  "",
    endTime:    "",
    allDay:     true,
    reason:     "Vacation",
    note:       "",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("new"); // "new" | "existing"
  const [cal, setCal] = useState(() => { const d = new Date(); return { m: d.getMonth(), y: d.getFullYear() }; });
  const [timeOpen, setTimeOpen] = useState(null); // "start" | "end" | null

  // Click a day to set the range: first click (or clicking before the current
  // start) sets a single-day block; a later day extends the end. Same calendar
  // styling as the booking schedule.
  function pickDay(ds) {
    setForm((f) => {
      if (!f.startDate || (f.startDate && f.endDate && f.startDate !== f.endDate) || ds < f.startDate) {
        return { ...f, startDate: ds, endDate: ds };
      }
      return { ...f, endDate: ds };
    });
  }

  async function handleSave() {
    if (!form.startDate || !form.endDate) return;
    setSaving(true);
    const member = members.find((m) => m.id === form.memberId);
    await onSave({
      ...form,
      memberName: member?.name || "All Team",
    });
    setSaving(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="modal-card relative w-full max-w-md">
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-semibold text-[#0F172A] text-base">Block Time</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="flex" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {["new", "existing"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? "border-[#3486cf] text-[#3486cf]" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t === "new" ? "Add Block" : `Existing (${timeBlocks.length})`}
            </button>
          ))}
        </div>

        {tab === "new" ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="label-field">Photographer</label>
              <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
                className="input-field w-full">
                <option value="">All Team (everyone blocked)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-field mb-0">Dates</label>
                <span className="text-xs text-gray-400">
                  {form.startDate === form.endDate
                    ? new Date(form.startDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : `${new Date(form.startDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(form.endDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <button type="button"
                    onClick={() => setCal((c) => c.m === 0 ? { m: 11, y: c.y - 1 } : { m: c.m - 1, y: c.y })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">‹</button>
                  <span className="text-xs font-semibold text-gray-700">{new Date(cal.y, cal.m, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}</span>
                  <button type="button"
                    onClick={() => setCal((c) => c.m === 11 ? { m: 0, y: c.y + 1 } : { m: c.m + 1, y: c.y })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg">›</button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {["S","M","T","W","T","F","S"].map((d, i) => (
                    <div key={i} className="text-center text-[9px] font-bold text-gray-400 pb-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                  {(() => {
                    const firstDay = new Date(cal.y, cal.m, 1).getDay();
                    const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
                    const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
                    return cells.map((d, i) => {
                      if (!d) return <div key={i} className="aspect-square" />;
                      const ds = `${cal.y}-${String(cal.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const inRange = ds >= form.startDate && ds <= form.endDate;
                      const isEdge  = ds === form.startDate || ds === form.endDate;
                      return (
                        <button key={i} type="button" onClick={() => pickDay(ds)}
                          className={`aspect-square rounded-lg text-[12px] font-medium flex items-center justify-center transition-all leading-none ${
                            isEdge ? "text-white" : inRange ? "text-[#3486cf]" : "text-gray-700 hover:bg-gray-100"
                          }`}
                          style={isEdge ? { backgroundColor: "#3486cf" } : inRange ? { backgroundColor: "rgba(52,134,207,0.12)" } : {}}>
                          {d}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["start", "From", "startTime"], ["end", "To", "endTime"]].map(([key, label, field]) => (
                <div key={key} className="relative">
                  <label className="label-field">{label}</label>
                  <button type="button" onClick={() => setTimeOpen(timeOpen === key ? null : key)}
                    className="input-field w-full text-left flex items-center justify-between">
                    <span className={form[field] ? "" : "text-gray-400"}>{form[field] ? fmtTimeOpt(form[field]) : "Any time"}</span>
                    <span className="text-gray-400 text-xs">▾</span>
                  </button>
                  {timeOpen === key && (
                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
                      <button type="button"
                        onClick={() => { setForm((f) => ({ ...f, [field]: "", allDay: key === "start" ? !f.endTime : !f.startTime })); setTimeOpen(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Any time</button>
                      {TIME_OPTIONS.map((t) => (
                        <button key={t} type="button"
                          onClick={() => { setForm((f) => ({ ...f, [field]: t, allDay: false })); setTimeOpen(null); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${form[field] === t ? "bg-[#3486cf]/10 text-[#3486cf] font-medium" : "text-gray-700"}`}>
                          {fmtTimeOpt(t)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 -mt-2">Leave both as “Any time” to block the whole day.</p>
            <div>
              <label className="label-field">Reason</label>
              <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="input-field w-full">
                {BLOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Note (optional)</label>
              <input type="text" value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="input-field w-full" placeholder="Internal note…" />
            </div>
            <div className="pt-2 flex gap-3">
              <button onClick={handleSave} disabled={saving || !form.startDate || !form.endDate}
                className="btn-primary px-6 py-2 text-sm flex-1">
                {saving ? "Saving…" : "Block Dates"}
              </button>
              <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {timeBlocks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No time blocks set.</p>
            ) : (
              timeBlocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{b.memberName} — {b.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                      {b.note && ` · ${b.note}`}
                    </p>
                  </div>
                  <button onClick={() => onDeleteBlock(b.id)}
                    className="text-xs text-red-500 hover:text-red-700 ml-3 font-medium">
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { permissions, userRole } = useDashboardPermissions();
  const canViewRevenue = userRole === "owner" || !!permissions?.canViewRevenue;
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "team");
  const [tenant,        setTenant]        = useState(null);
  const [members,       setMembers]       = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [bookings,      setBookings]      = useState([]);
  const [products,      setProducts]      = useState({ services: [], packages: [], addons: [] });
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(null);
  const [anchor,        setAnchor]        = useState(new Date());
  const [filterMember,  setFilterMember]  = useState("all");
  const [availPhotographersOnly, setAvailPhotographersOnly] = useState(true);
  const [calModal,      setCalModal]      = useState(null);
  const [calView,       setCalView]       = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("kyoria_schedule_view") || "week";
    return "week";
  });  // "2wk" | "week" | "month" | "day"
  const [addMode,       setAddMode]       = useState(null); // null | "choice" | "invite"
  const [inviteForm,    setInviteForm]    = useState({ email: "", role: "photographer", customRoleTitle: "", permissions: { ...DEFAULT_PERMISSIONS.photographer } });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState("");
  const [inviteUrl,     setInviteUrl]     = useState("");
  const [timeBlocks,    setTimeBlocks]    = useState([]);
  const [showBlockModal,    setShowBlockModal]    = useState(false);
  const [blockDetail,       setBlockDetail]       = useState(null); // { member, blocks, date }
  const [eventDetail,       setEventDetail]       = useState(null); // booking event for popover
  const [showOwnerCalModal, setShowOwnerCalModal] = useState(false);

  const getToken = (forceRefresh = false) => auth.currentUser?.getIdToken(forceRefresh);

  // Handle OAuth callback params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calSuccess")) {
      toast("Google Calendar connected successfully!");
      window.history.replaceState({}, "", "/dashboard/team");
    } else if (params.get("calError")) {
      toast("Calendar connection failed: " + params.get("calError"), "error");
      window.history.replaceState({}, "", "/dashboard/team");
    }
  }, []);

  useEffect(() => {
    async function load() {
      if (isDemo()) {
        const d = getDemoTeam();
        setTenant(d.tenant);
        setMembers(d.members);
        setBookings(d.bookings);
        setProducts(d.products);
        setTimeBlocks(d.timeBlocks);
        setLoading(false);
        return;
      }
      const token = await getToken(true);
      const [teamRes, listRes, svcRes, pkgRes, adnRes, blocksRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/team",                   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/listings",               { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=packages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=addons",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team/blocks",            { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",                 { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [teamData, listData, svcData, pkgData, adnData, blocksData, tenantData] = await Promise.all([
        teamRes.json(), listRes.json(), svcRes.json(), pkgRes.json(), adnRes.json(), blocksRes.json(), tenantRes.json(),
      ]);
      setTenant(tenantData.tenant || null);
      setMembers(teamData.members   || []);
      setBookings(listData.listings || []);
      // Pending invites (sent but not yet accepted) — non-blocking.
      fetch("/api/dashboard/team/invite", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : { invites: [] })
        .then((d) => setPendingInvites(d.invites || []))
        .catch(() => {});
      setProducts({
        services: svcData.items || [],
        packages: pkgData.items || [],
        addons:   adnData.items || [],
      });
      setTimeBlocks(blocksData.blocks || []);
      setLoading(false);
    }
    load();
  }, []);

  // Auto-sync connected Google Calendars once when the team page loads, so the
  // calendar is up to date (added + removed events) without manually clicking
  // Sync. Per-member server-side rate limiting prevents this from hammering
  // Google on rapid reloads.
  useEffect(() => {
    if (isDemo()) return;
    let cancelled = false;
    (async () => {
      try {
        // Cost protection: only auto-sync if it's been > 1 hour since the last
        // auto-sync (the server also rate-limits per member as a backstop).
        const AUTO_SYNC_MIN_MS = 60 * 60 * 1000;
        try {
          const last = Number(localStorage.getItem("kyoria_autosync_ts") || 0);
          if (Date.now() - last < AUTO_SYNC_MIN_MS) return;
          localStorage.setItem("kyoria_autosync_ts", String(Date.now()));
        } catch { /* localStorage unavailable — fall through, server still throttles */ }

        const token = await getToken();
        const res = await fetch("/api/dashboard/team/google-connected", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const { ids } = await res.json();
        if (cancelled || !ids?.length) return;
        await Promise.allSettled(ids.map((memberId) =>
          fetch("/api/dashboard/team/google-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ memberId }),
          })
        ));
        if (!cancelled) window.dispatchEvent(new CustomEvent("kyoria:blocks-updated"));
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh busy blocks the moment a Google sync runs (or another tab syncs),
  // so newly-synced events appear — and events deleted in Google disappear —
  // immediately, without a page reload.
  useEffect(() => {
    async function refreshBlocks() {
      try {
        const token = await getToken();
        const res = await fetch("/api/dashboard/team/blocks", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setTimeBlocks(d.blocks || []); }
      } catch { /* ignore */ }
    }
    const onUpdate = () => refreshBlocks();
    const onStorage = (e) => { if (e.key === "kyoria_blocks_ts") refreshBlocks(); };
    window.addEventListener("kyoria:blocks-updated", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("kyoria:blocks-updated", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function saveMember(form) {
    const token = await getToken();
    try {
      if (editing === "new") {
        const res  = await fetch("/api/dashboard/team", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Failed to add member.", "error"); return; }
        setMembers((m) => [...m, data.member]);
        toast("Team member added.");
      } else {
        const res  = await fetch(`/api/dashboard/team/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Failed to save.", "error"); return; }
        // Use server-confirmed data so the UI always reflects what's in Firestore
        const saved = data.member || { ...editing, ...form };
        setMembers((m) => m.map((x) => x.id === editing.id ? saved : x));
        toast("Team member saved.");
      }
    } catch { toast("Something went wrong.", "error"); }
    setEditing(null);
  }

  async function refreshTenant() {
    try {
      const token = await getToken();
      const res  = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setTenant(data.tenant || null);
    } catch { /* non-fatal */ }
  }

  async function deleteMember() {
    const token = await getToken();
    await fetch(`/api/dashboard/team/${editing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setMembers((m) => m.filter((x) => x.id !== editing.id));
    setEditing(null);
  }

  // ─── Calendar ──────────────────────────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);

  // 14 days (2 weeks) starting from the Sunday of the anchor week
  const twoWeekDates = useMemo(() => {
    const sunday = getWeekDates(anchor)[0];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  }, [anchor]);

  function prevPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      if (calView === "month") n.setMonth(n.getMonth() - 1);
      else if (calView === "day") n.setDate(n.getDate() - 1);
      else if (calView === "2wk") n.setDate(n.getDate() - 14);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  }
  function nextPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      if (calView === "month") n.setMonth(n.getMonth() + 1);
      else if (calView === "day") n.setDate(n.getDate() + 1);
      else if (calView === "2wk") n.setDate(n.getDate() + 14);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  }
  function goToday() { setAnchor(new Date()); }

  function switchTab(id) {
    setActiveTab(id);
    router.replace(`/dashboard/team?tab=${id}`, { scroll: false });
  }

  function closeAddModal() {
    setAddMode(null);
    setInviteForm({ email: "", role: "photographer", permissions: { ...DEFAULT_PERMISSIONS.photographer } });
    setInviteMsg("");
    setInviteUrl("");
  }

  async function sendInvite() {
    if (!inviteForm.email.trim()) return;
    setInviteSending(true);
    setInviteMsg("");
    setInviteUrl("");
    try {
      const token = await getToken();
      // Manager/Admin get dashboard access; all others get photographer portal
      const endpoint = DASHBOARD_ROLES.includes(inviteForm.role)
        ? "/api/dashboard/team/staff"
        : "/api/dashboard/team/invite";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteForm.email.trim(), role: inviteForm.role, customRoleTitle: inviteForm.customRoleTitle, permissions: inviteForm.permissions }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.emailFailed) {
          setInviteMsg("⚠ Email could not be sent — share this link manually:");
          setInviteUrl(data.inviteUrl || "");
        } else {
          setInviteMsg(`✓ Invite sent to ${inviteForm.email.trim()}`);
          setTimeout(closeAddModal, 2500);
        }
      } else {
        setInviteMsg(data.error || "Failed to send invite.");
      }
    } catch {
      setInviteMsg("Something went wrong.");
    } finally {
      setInviteSending(false);
    }
  }

  function notifyBlocksChanged() {
    window.dispatchEvent(new CustomEvent("kyoria:blocks-updated"));
    try { localStorage.setItem("kyoria_blocks_ts", Date.now().toString()); } catch {}
  }

  async function createBlock(blockData) {
    const token = await getToken();
    const res = await fetch("/api/dashboard/team/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(blockData),
    });
    const data = await res.json();
    if (res.ok) { setTimeBlocks((prev) => [...prev, data.block]); notifyBlocksChanged(); }
    return res.ok;
  }

  async function deleteBlock(id) {
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
    try {
      const token = await getToken(true);
      const res = await fetch(`/api/dashboard/team/blocks?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setTimeBlocks((prev) => prev); // no rollback needed; reload will restore
        toast("Failed to remove block.", "error");
      } else {
        notifyBlocksChanged();
      }
    } catch {
      toast("Failed to remove block.", "error");
    }
  }

  // ── Month view helpers ────────────────────────────────────────────────────
  const monthDates = useMemo(() => {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const startDow = first.getDay();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchor]);

  // Persist calView to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("kyoria_schedule_view", calView);
  }, [calView]);

  // All non-cancelled bookings with a confirmed shootDate appear on the calendar.
  // Only shootDate (not preferredDate) counts — preferredDate is unconfirmed client preference.
  const calendarEvents = useMemo(() => {
    return bookings
      .filter((b) => b.shootDate && b.status !== "cancelled")
      .map((b) => {
        const ds = typeof b.shootDate === "string" && b.shootDate.length === 10
          ? b.shootDate + "T12:00:00"
          : b.shootDate;
        return { ...b, shootDateObj: new Date(ds) };
      });
  }, [bookings]);

  // Bookings with no shoot date yet (needs scheduling) — any non-cancelled booking without a shootDate
  const unscheduled = bookings.filter(
    (b) => !b.shootDate && b.status !== "cancelled"
  );

  const weekShootCount = useMemo(() =>
    calendarEvents.filter(e => weekDates.some(d => isSameDay(e.shootDateObj, d))).length,
    [calendarEvents, weekDates]
  );

  const weekRevenue = useMemo(() =>
    calendarEvents
      .filter(e => weekDates.some(d => isSameDay(e.shootDateObj, d)))
      .reduce((sum, e) => {
        if (e.paidInFull || e.balancePaid) return sum + (e.totalPrice || 0);
        if (e.depositPaid) return sum + (e.depositAmount || 0);
        return sum;
      }, 0),
    [calendarEvents, weekDates]
  );

  const today = new Date();
  today.setHours(0,0,0,0);

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const planId = getEffectivePlan(tenant);
  const seatLimit = getSeatLimit(planId, tenant?.addonSeats || 0);
  const isSolo = planId === "solo";
  const atSeatLimit = isSolo || (seatLimit !== null && (members.length + 1) >= seatLimit);
  const ownerLabel = tenant?.ownerName || tenant?.businessName || "You";
  const soloOwnerMember = { id: "__owner__", name: ownerLabel, color: "#3486cf" };
  // Whether the owner personally shoots / appears in scheduling (default: yes).
  const ownerShoots = tenant?.ownerShoots !== false;

  // In availability views hide inactive photographers; the member list still shows all
  const activeMembers = members.filter((m) => m.active !== false);
  const visibleMembers = filterMember === "__owner__"
    ? [soloOwnerMember]
    : filterMember === "all"
      ? (calView === "2wk" || calView === "week" ? [soloOwnerMember, ...activeMembers] : [soloOwnerMember, ...members])
          // "Photographers only" hides non-shooting roles. The owner is hidden by
          // this filter too when they've turned off "I shoot".
          .filter((m) => m.id === "__owner__"
            ? (ownerShoots || !availPhotographersOnly)
            : (!availPhotographersOnly || shootsSchedule(m)))
      : members.filter((m) => m.id === filterMember);

  const feature = { scheduleNewTabs: false };
  const SCHEDULE_TABS = [
    { id: "team",        label: "Calendar" },
    { id: "unscheduled", label: "Unscheduled", badge: unscheduled.length },
    ...(feature.scheduleNewTabs ? [
      { id: "members",      label: "Team" },
      { id: "availability", label: "Availability" },
    ] : []),
  ];

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-0">
        <div>
          <h1 className="page-title">Team Schedule</h1>
          {activeTab === "team" && (
            <p className="page-subtitle">
              {isSolo && members.length === 0
                ? "Solo plan · just you"
                : `${members.length} team member${members.length !== 1 ? "s" : ""}${seatLimit !== null ? ` · ${seatLimit} seat${seatLimit !== 1 ? "s" : ""} on your plan` : ""}`}
            </p>
          )}
        </div>
        {activeTab === "team" ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBlockModal(true)} className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
              🚫 Block Time
            </button>
            {atSeatLimit ? (
              <a href="/dashboard/billing"
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg border border-[#3486cf]/30 text-[#3486cf] hover:bg-[#3486cf]/5 transition-colors">
                Upgrade to Add Members
              </a>
            ) : (
              <button onClick={() => setAddMode("choice")} className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
                <span className="text-lg leading-none">+</span> Add Team Member
              </button>
            )}
          </div>
        ) : (
          <Link href="/dashboard/bookings/create"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#3486cf] text-white hover:bg-[#2a6dab] transition-colors">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Booking
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-6 pt-4 border-b border-gray-200">
        {SCHEDULE_TABS.map((tab) => (
          <button key={tab.id} onClick={() => switchTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "border-[#3486cf] text-[#3486cf]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}>
            {tab.label}
            {tab.badge > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Unscheduled tab content */}
      {activeTab === "unscheduled" && <BookingUnscheduledTab listings={bookings} />}

      {/* Team placeholder tab */}
      {activeTab === "members" && (
        <div className="p-10 text-center text-gray-400">
          <p className="text-2xl mb-2">👥</p>
          <p className="font-medium text-gray-500">Team management coming soon</p>
          <p className="text-sm mt-1">Full team profiles, roles, and permissions will live here.</p>
        </div>
      )}

      {/* Availability placeholder tab */}
      {activeTab === "availability" && (
        <div className="p-10 text-center text-gray-400">
          <p className="text-2xl mb-2">📅</p>
          <p className="font-medium text-gray-500">Availability management coming soon</p>
          <p className="text-sm mt-1">Set recurring availability and time-off windows for your team here.</p>
        </div>
      )}

      {/* Team tab content */}
      {activeTab === "team" && <div className="p-6">

      {/* Empty state */}
      {members.length === 0 && (
        <div className="card p-10 text-center mb-6">
          <div className="text-5xl mb-3">👥</div>
          {isSolo ? (
            <>
              <p className="font-semibold text-[#0F172A] mb-1">Team members require Studio plan or above</p>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                The Solo plan is designed for individual photographers. Upgrade to Studio to add photographers, assistants, and managers.
              </p>
              <a href="/dashboard/billing" className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2">
                View Upgrade Options
              </a>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#0F172A] mb-1">No team members yet</p>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                Add photographers, managers, admins, or a custom role. Only photographers appear in the booking schedule.
              </p>
              <button onClick={() => setAddMode("choice")} className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2">
                <span className="text-lg leading-none">+</span> Add Your First Team Member
              </button>
            </>
          )}
        </div>
      )}

      {/* Team member cards — owner always shown first */}
      <div className="flex gap-3 flex-wrap mb-6">
        {/* Owner card */}
        <div className="flex items-center gap-3 card px-4 py-3 card-hover">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: "#3486cf" }}>
            {ownerLabel[0]?.toUpperCase() || "Y"}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-[#0F172A]">{ownerLabel}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-100">owner</span>
              {!ownerShoots && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200">not shooting</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowOwnerCalModal(true)}
            title={tenant?.ownerGoogleCalendar?.refreshToken ? `Last synced: ${tenant.ownerGoogleCalendar.lastSynced ? new Date(tenant.ownerGoogleCalendar.lastSynced).toLocaleDateString() : "never"}` : "Sync your personal calendar"}
            className={`ml-2 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
              tenant?.ownerGoogleCalendar?.refreshToken
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-400 hover:border-[#3486cf]/40 hover:text-[#3486cf]"
            }`}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {tenant?.ownerGoogleCalendar?.refreshToken ? "Cal Synced" : "Sync Cal"}
          </button>
        </div>
        {/* Pending invites — sent but not yet accepted */}
        {pendingInvites.length > 0 && (
          <div className="card px-4 py-3 border-amber-200 bg-amber-50/60">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">Invitations awaiting acceptance</p>
            <div className="space-y-1.5">
              {pendingInvites.map((inv) => (
                <div key={inv.token} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{inv.email}</p>
                    <p className="text-[11px] text-amber-600">
                      Invited as {inv.customRoleTitle || inv.role} · awaiting acceptance
                      {inv.expiresAt ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">Pending</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-600 mt-2">Invited photographers appear in scheduling and manual booking once they accept and set up their account.</p>
          </div>
        )}
        {/* Team member cards */}
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 card px-4 py-3 card-hover">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: m.color || "#0b2a55" }}>
              {m.name?.[0]?.toUpperCase() || "?"}
            </div>
            <button onClick={() => setEditing(m)} className="text-left">
              <p className="text-sm font-medium text-[#0F172A]">{m.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {(() => { const rc = ROLE_COLORS[normalizeRole(m.role)] || ROLE_COLORS.photographer; return (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${rc.bg} ${rc.text} ${rc.border}`}>
                    {roleLabel(m)}
                  </span>
                ); })()}
                {m.skills?.length > 0 && <span className="text-[10px] text-gray-400">{m.skills.length} skills</span>}
              </div>
            </button>
            {normalizeRole(m.role) === "photographer" && (() => {
              const slot = nextAvailableSlot(m, bookings, timeBlocks, tenant?.bookingConfig?.slotDuration || 60);
              return slot ? (
                <span className="ml-auto text-[11px] px-2 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 font-medium whitespace-nowrap flex items-center gap-1" title="Next open booking slot">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Next free: {formatSlot(slot)}
                </span>
              ) : (
                <span className="ml-auto text-[11px] px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-medium whitespace-nowrap" title="No open slots in the next 3 weeks">
                  Booked 3 wks
                </span>
              );
            })()}
            <button
              onClick={() => setCalModal(m)}
              title={m.googleCalendar?.refreshToken ? `Last synced: ${m.googleCalendar.lastSynced ? new Date(m.googleCalendar.lastSynced).toLocaleDateString() : "never"}` : "Not connected — member connects from their profile"}
              className={`ml-2 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                m.googleCalendar?.refreshToken
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {m.googleCalendar?.refreshToken ? "Cal Synced" : "No Cal"}
            </button>
          </div>
        ))}
      </div>

      {/* Calendar section + right rail */}
      <div className="flex items-start gap-4 mb-6">
      <div className="card-section overflow-hidden flex-1 min-w-0">
        {/* Calendar toolbar */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {/* Row 1: nav + view toggle */}
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={prevPeriod} className="px-2.5 py-1.5 hover:bg-gray-50 transition-colors border-r border-gray-200">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="px-3 py-1.5 text-sm font-semibold text-[#0F172A] text-center" style={{ minWidth: 220 }}>
                  {calView === "month"
                    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
                    : calView === "day"
                    ? `${DAYS_SHORT[anchor.getDay()]}, ${MONTHS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`
                    : calView === "2wk"
                    ? `${MONTHS[twoWeekDates[0].getMonth()].slice(0,3)} ${twoWeekDates[0].getDate()} – ${MONTHS[twoWeekDates[13].getMonth()].slice(0,3)} ${twoWeekDates[13].getDate()}, ${twoWeekDates[0].getFullYear()}`
                    : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`
                  }
                </span>
                <button onClick={nextPeriod} className="px-2.5 py-1.5 hover:bg-gray-50 transition-colors border-l border-gray-200">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <button onClick={goToday} className="text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 font-medium text-gray-600 transition-colors">Today</button>
            </div>
            <div className="seg">
              {[
                { key: "2wk",   label: "2 Wk" },
                { key: "week",  label: "Week" },
                { key: "month", label: "Month" },
                { key: "day",   label: "Day" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setCalView(key)} className={calView === key ? "seg-active" : ""}>{label}</button>
              ))}
            </div>
          </div>
          {/* Row 2: stats + photographer filter chips */}
          <div className="flex items-center justify-between px-4 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{weekShootCount} shoot{weekShootCount !== 1 ? "s" : ""} this week</span>
              {canViewRevenue && weekRevenue > 0 && (
                <span className="font-semibold" style={{ color: "#3486cf" }}>· ${weekRevenue.toLocaleString()} booked</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 font-medium mr-0.5">Filter:</span>
              <button
                onClick={() => setFilterMember("all")}
                className={`fchip${filterMember === "all" ? " fchip-active" : ""}`}>
                All
              </button>
              {(() => {
                const ownerActive = filterMember === "__owner__";
                const ownerColor  = "#3486cf";
                return (
                  <button
                    onClick={() => setFilterMember(ownerActive ? "all" : "__owner__")}
                    className="fchip"
                    style={ownerActive ? { background: ownerColor + "18", borderColor: ownerColor, color: ownerColor, fontWeight: 600 } : {}}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ fontSize: 8, background: ownerColor }}>
                      {ownerLabel[0]?.toUpperCase() || "Y"}
                    </span>
                    {ownerLabel.split(" ")[0]}
                  </button>
                );
              })()}
              {members.filter((m) => !availPhotographersOnly || shootsSchedule(m)).map((m) => {
                const isActive = filterMember === m.id;
                const color    = m.color || "#0b2a55";
                return (
                  <button
                    key={m.id}
                    onClick={() => setFilterMember(isActive ? "all" : m.id)}
                    className="fchip"
                    style={isActive ? { background: color + "18", borderColor: color, color, fontWeight: 600 } : {}}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ fontSize: 8, background: color }}>
                      {initials(m.name).slice(0, 2)}
                    </span>
                    {m.name.split(" ")[0]}
                  </button>
                );
              })}
              {filterMember !== "all" && (
                <button
                  onClick={() => setFilterMember("all")}
                  className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-0.5"
                  title="Clear filter">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 2-WEEK AVAILABILITY GRID ───────────────────────────────────── */}
        {calView === "2wk" && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-32 min-w-32 text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-gray-200 bg-gray-50/60 sticky left-0 z-10">
                      Photographer
                    </th>
                    {twoWeekDates.map((d, i) => {
                      const isToday    = isSameDay(d, today);
                      const isSunday   = d.getDay() === 0;
                      const isWeek2Start = i === 7;
                      return (
                        <th key={d.toISOString()}
                          className={`text-center py-2 px-1 border-b border-r last:border-r-0 border-gray-200 min-w-14 ${
                            isToday    ? "bg-[#3486cf]/5"  :
                            isWeek2Start ? "bg-gray-50" : ""
                          }`}>
                          {isWeek2Start && (
                            <div className="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">Next Wk</div>
                          )}
                          {i === 0 && (
                            <div className="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">This Wk</div>
                          )}
                          <div className={`text-[10px] uppercase font-semibold ${isToday ? "text-[#3486cf]" : "text-gray-400"}`}>
                            {DAYS_SHORT[d.getDay()]}
                          </div>
                          <div className={`text-sm font-bold leading-tight ${
                            isToday ? "w-7 h-7 rounded-full bg-[#3486cf] text-white flex items-center justify-center mx-auto" : "text-[#0F172A]"
                          }`}>
                            {d.getDate()}
                          </div>
                          <div className="text-[10px] text-gray-300 mt-0.5">
                            {MONTHS[d.getMonth()].slice(0,3)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* All-Team blocks row — always visible when any null-memberId block exists */}
                  {(() => {
                    const allTeamBlocks = timeBlocks.filter((b) => !b.memberId);
                    if (allTeamBlocks.length === 0) return null;
                    return (
                      <tr className="border-b border-red-100 bg-red-50/20">
                        <td className="px-3 py-2 border-r border-gray-200 bg-red-50/60 sticky left-0 z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="font-semibold text-red-700 text-[11px] uppercase tracking-wide">All Team</span>
                          </div>
                        </td>
                        {twoWeekDates.map((d, i) => {
                          const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                          const hasBlock = allTeamBlocks.some((b) => {
                            const s = blockDateStr(b, "start");
                            const e = blockDateStr(b, "end");
                            return ds >= s && ds <= e;
                          });
                          return (
                            <td key={d.toISOString()} className={`text-center py-2 px-1 border-r last:border-r-0 border-gray-100 min-w-14 ${i >= 7 ? "bg-red-50/10" : ""}`}>
                              {hasBlock && (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500 mx-auto font-bold" style={{ fontSize: 14 }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })()}
                  {visibleMembers.map((member) => {
                    const memberEvents = member.id === "__owner__"
                      ? calendarEvents.filter((e) => !e.photographerId || e.photographerId === "__owner__")
                      : calendarEvents.filter(
                          (e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email)
                        );
                    return (
                      <tr key={member.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 transition-colors">
                        <td className="px-3 py-2 border-r border-gray-200 bg-white sticky left-0 z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                            <span className="font-medium text-[#0F172A] truncate max-w-24">{member.name}</span>
                          </div>
                        </td>
                        {twoWeekDates.map((d, i) => {
                          const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                          const dayEvents  = memberEvents.filter((e) => isSameDay(e.shootDateObj, d));
                          const dayBlocks  = timeBlocks.filter((b) => {
                            const startStr = blockDateStr(b, "start");
                            const endStr   = blockDateStr(b, "end");
                            return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                          });
                          const isBlocked  = dayBlocks.some((b) => b.allDay !== false);
                          const isPast     = d < today;
                          const isToday    = isSameDay(d, today);
                          const count      = dayEvents.length;
                          const isWeek2    = i >= 7;

                          return (
                            <td key={d.toISOString()}
                              className={`text-center py-2 px-1 border-r last:border-r-0 border-gray-100 min-w-14 align-middle ${
                                isToday  ? "bg-[#3486cf]/3"  :
                                isWeek2  ? "bg-gray-50/50" :
                                isPast   ? "bg-gray-50/30" : ""
                              }`}>
                              {isBlocked ? (
                                <button
                                  onClick={() => setBlockDetail({ member, blocks: dayBlocks, date: d })}
                                  title="Click for details"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500 mx-auto hover:bg-red-200 transition-colors cursor-pointer" style={{ fontSize: 14 }}>
                                  —
                                </button>
                              ) : count > 0 ? (
                                <button
                                  onClick={() => setEventDetail({ ...dayEvents[0], memberColor: member.color || "#0b2a55" })}
                                  title={dayEvents.map((e) => e.address?.split(",")[0]).join(", ")}
                                  className="inline-flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity">
                                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold mx-auto"
                                    style={{ background: member.color || "#0b2a55" }}>
                                    {count}
                                  </span>
                                  {(() => {
                                    const t = dayEvents[0].shootTime || dayEvents[0].preferredTime;
                                    const valid = t && /^(\d{1,2}:\d{2}|morning|afternoon|evening|flexible|twilight)$/i.test(t.trim());
                                    return valid ? (
                                      <span className="text-[10px] text-gray-400 capitalize leading-none">{t.slice(0, 3)}</span>
                                    ) : null;
                                  })()}
                                </button>
                              ) : isPast ? (
                                <span className="block w-1.5 h-1.5 rounded-full bg-gray-200 mx-auto" />
                              ) : (
                                <span className="block w-2 h-2 rounded-full bg-green-400 mx-auto" title="Available" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#3486cf] inline-flex items-center justify-center text-white text-[10px] font-bold">1</span> Booked (tap to view)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-red-100 inline-flex items-center justify-center text-red-500 text-xs">—</span> Blocked
              </span>
            </div>
          </div>
        )}

        {/* ── WEEK VIEW ──────────────────────────────────────────────────── */}
        {calView === "week" && (<>
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDates.map((d) => {
              const isToday = isSameDay(d, today);
              return (
                <div key={d.toISOString()} className={`px-2 py-3 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-[#3486cf]/4" : ""}`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                  <p className={`text-base font-bold mt-0.5 ${isToday ? "w-8 h-8 rounded-full bg-[#3486cf] text-white flex items-center justify-center mx-auto" : "text-[#0F172A]"}`}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>
          <div>
              {/* All-Team blocks row */}
              {(() => {
                const allTeamBlocks = timeBlocks.filter((b) => !b.memberId);
                if (allTeamBlocks.length === 0) return null;
                return (
                  <div className="border-b border-red-100 bg-red-50/20">
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50/60">
                      <div className="w-5 h-5 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-red-700">All Team — Blocked</p>
                    </div>
                    <div className="grid grid-cols-7 min-h-14">
                      {weekDates.map((d) => {
                        const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        const dayBlocks = allTeamBlocks.filter((b) => {
                          const s = blockDateStr(b, "start");
                          const e = blockDateStr(b, "end");
                          return dayStr >= s && dayStr <= e;
                        });
                        const isToday = isSameDay(d, today);
                        return (
                          <div key={d.toISOString()} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-14 relative ${isToday ? "bg-red-50/30" : ""}`}>
                            {dayBlocks.some((b) => b.allDay !== false) && (
                              <div className="absolute inset-0 pointer-events-none"
                                style={{ background: "repeating-linear-gradient(-45deg, #fee2e2, #fee2e2 3px, transparent 3px, transparent 10px)", opacity: 0.6 }} />
                            )}
                            <div className="relative z-10">
                              {dayBlocks.map((bl) => (
                                <div key={bl.id} className="text-xs border-l-2 border-red-400 px-1.5 py-0.5 rounded mb-1 bg-red-50">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-medium text-red-600 truncate">{bl.reason || "Blocked"}</span>
                                    <button onClick={() => deleteBlock(bl.id)} className="opacity-60 hover:opacity-100 text-red-500 text-[10px] flex-shrink-0">×</button>
                                  </div>
                                  {(bl.startTime || bl.endTime) && (
                                    <p className="text-[10px] text-red-400">{fmt12(bl.startTime)}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {visibleMembers.map((member) => {
                const memberEvents = member.id === "__owner__"
                  ? calendarEvents.filter((e) => !e.photographerId || e.photographerId === "__owner__")
                  : calendarEvents.filter((e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email));
                return (
                  <div key={member.id} className="border-b last:border-b-0 border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
                      <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                      <p className="text-xs font-semibold text-[#0F172A]">{member.id === "__owner__" ? `${member.name} (you)` : member.name}</p>
                      {member.id !== "__owner__" && (() => {
                        const allProds = [...(products.services || []), ...(products.packages || []), ...(products.addons || [])];
                        const skillLabels = (member.skills || [])
                          .map((s) => SKILL_LABELS[s] || allProds.find((p) => p.id === s)?.name || null)
                          .filter(Boolean);
                        if (!skillLabels.length) return null;
                        return (
                          <div className="flex gap-1 flex-wrap ml-1">
                            {skillLabels.slice(0, 4).map((label, i) => (
                              <span key={i} className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-xl">{label}</span>
                            ))}
                            {skillLabels.length > 4 && <span className="text-xs text-gray-400">+{skillLabels.length - 4} more</span>}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-7 min-h-20">
                      {weekDates.map((d) => {
                        const dayEvents = memberEvents.filter((e) => isSameDay(e.shootDateObj, d));
                        const isToday = isSameDay(d, today);
                        // Compare as YYYY-MM-DD strings to avoid timezone shifts
                        const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        const dayBlocks = timeBlocks.filter((b) => {
                          const startStr = blockDateStr(b, "start");
                            const endStr   = blockDateStr(b, "end");
                          return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                        });
                        const hasAllDayBlock = dayBlocks.some((b) => b.allDay !== false);
                        return (
                          <div key={d.toISOString()} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-20 relative`}
                          style={isToday ? { background: "rgba(52,134,207,0.025)" } : undefined}>
                            {hasAllDayBlock && (
                              <div className="absolute inset-0 pointer-events-none"
                                style={{ background: `repeating-linear-gradient(-45deg, ${hexWithAlpha(member.color || "#0b2a55", 0.12)}, ${hexWithAlpha(member.color || "#0b2a55", 0.12)} 3px, transparent 3px, transparent 10px)` }} />
                            )}
                            <div className="relative z-10">
                            {dayBlocks.map((bl) => (
                              <div key={bl.id} className="text-xs border-l-2 px-1.5 py-0.5 rounded-xl mb-1 group"
                                style={{ background: hexWithAlpha(member.color || "#0b2a55", 0.1), borderLeftColor: member.color || "#0b2a55" }}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate" style={{ color: member.color || "#0b2a55" }}>{blockLabel(bl, member)}</span>
                                  <button onClick={() => deleteBlock(bl.id)}
                                    className="opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 text-[10px]"
                                    style={{ color: member.color || "#0b2a55" }}>×</button>
                                </div>
                                {(bl.startTime || bl.endTime) && (
                                  <p className="text-[10px]" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.7) }}>
                                    {fmt12(bl.startTime)}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}
                                  </p>
                                )}
                              </div>
                            ))}
                            {dayEvents.map((ev) => {
                              const displayTime = ev.shootTime || ev.preferredTime;
                              const validTime = displayTime && /^(\d{1,2}:\d{2}|morning|afternoon|evening|flexible|twilight)$/i.test(displayTime.trim());
                              const line2 = [validTime ? displayTime : null, ev.address?.split(",")[0]].filter(Boolean).join(" · ");
                              const color = member.color || "#0b2a55";
                              return (
                                <button key={ev.id}
                                  onClick={() => setEventDetail({ ...ev, memberColor: color })}
                                  style={{ background: color + "22", borderLeftColor: color }}
                                  className="shoot-pill w-full text-left hover:opacity-80 transition-opacity">
                                  <p className="font-semibold truncate" style={{ color }}>{ev.clientName?.split(" ")[0] || ev.address?.split(",")[0] || "Booking"}</p>
                                  {line2 && <p className="truncate text-[10px] opacity-60" style={{ color }}>{line2}</p>}
                                </button>
                              );
                            })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filterMember === "all" && (
                <div className="border-t border-dashed border-gray-200">
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Unassigned shoots</p>
                    <span className="text-xs text-amber-600 ml-1">({unscheduled.length})</span>
                  </div>
                  <div className="grid grid-cols-7 min-h-12">
                    {weekDates.map((d) => {
                      const dayUnscheduled = unscheduled.filter((b) => {
                        if (!b.preferredDate) return false;
                        return isSameDay(new Date(b.preferredDate + "T12:00:00"), d);
                      });
                      return (
                        <div key={d.toISOString()} className="p-1 border-r last:border-r-0 border-gray-100 min-h-12">
                          {dayUnscheduled.map((b) => (
                            <div key={b.id} className="text-xs bg-amber-50 border-l-2 border-amber-400 px-1.5 py-1 rounded-xl mb-1">
                              <p className="font-medium text-amber-700 truncate">{b.address}</p>
                              <p className="text-amber-500 capitalize">{b.preferredTime}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>

          {/* ── Availability recap ─────────────────────────────────────────── */}
          {visibleMembers.length > 0 && (() => {
            // Admins/managers never shoot, so the availability recap can hide them.
            // Owner, photographers, and assistants are shooting roles.
            const recapMembers = availPhotographersOnly
              ? visibleMembers.filter((m) => m.id === "__owner__" ? ownerShoots : shootsSchedule(m))
              : visibleMembers;
            return (
            <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">This Week&apos;s Availability</p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={availPhotographersOnly}
                    onChange={(e) => setAvailPhotographersOnly(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-[#3486cf] focus:ring-[#3486cf]/30" />
                  <span className="text-xs text-gray-500">Photographers only</span>
                </label>
              </div>
              <div className="space-y-2">
                {recapMembers.map((member) => {
                  const memberEvents = member.id === "__owner__"
                    ? calendarEvents.filter((e) => !e.photographerId || e.photographerId === "__owner__")
                    : calendarEvents.filter((e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email));
                  const bookedDays = new Set(
                    memberEvents
                      .filter((e) => weekDates.some((d) => isSameDay(e.shootDateObj, d)))
                      .map((e) => DAYS_SHORT[e.shootDateObj.getDay()])
                  );
                  // Also mark days with time blocks as unavailable
                  weekDates.forEach((d) => {
                    const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    const hasBlock = timeBlocks.some((b) => {
                      const startStr = blockDateStr(b, "start");
                      const endStr   = blockDateStr(b, "end");
                      return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                    });
                    if (hasBlock) bookedDays.add(DAYS_SHORT[d.getDay()]);
                  });
                  const freeDays = weekDates
                    .filter((d) => d >= today && !bookedDays.has(DAYS_SHORT[d.getDay()]))
                    .map((d) => `${DAYS_SHORT[d.getDay()]} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`);
                  return (
                    <div key={member.id} className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                      <div>
                        <span className="text-xs font-semibold text-[#0F172A]">{member.name}: </span>
                        {freeDays.length === 0
                          ? <span className="text-xs text-amber-600">Fully booked this week</span>
                          : <span className="text-xs text-green-700">Free — {freeDays.join(", ")}</span>
                        }
                        {bookedDays.size > 0 && (
                          <span className="text-xs text-gray-400 ml-2">· Booked: {Array.from(bookedDays).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}
        </>)}

        {/* ── MONTH VIEW ─────────────────────────────────────────────────── */}
        {calView === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-xs text-gray-400 uppercase tracking-wide border-r last:border-r-0 border-gray-100">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDates.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} className="border-r last:border-r-0 border-b border-gray-100 min-h-20 bg-gray-50/30" />;
                const isToday = isSameDay(d, today);
                const dayStr  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                const dayEvents = calendarEvents.filter((e) => isSameDay(e.shootDateObj, d));
                const visibleDayEvents = filterMember === "all"
                  ? dayEvents
                  : filterMember === "__owner__"
                    ? dayEvents.filter((e) => !e.photographerId || e.photographerId === "__owner__")
                    : dayEvents.filter((e) => e.photographerId === filterMember);
                const dayBlocks = timeBlocks.filter((b) => {
                  const startStr = blockDateStr(b, "start");
                            const endStr   = blockDateStr(b, "end");
                  const memberMatch = (filterMember === "all" || filterMember === "__owner__") ? true : (!b.memberId || b.memberId === filterMember);
                  return dayStr >= startStr && dayStr <= endStr && memberMatch;
                });
                const hasBlocks = dayBlocks.some((b) => b.allDay !== false);
                return (
                  <div key={d.toISOString()} className={`border-r last:border-r-0 border-b border-gray-100 p-1.5 relative ${isToday ? "bg-blue-50/30" : ""}`} style={{ minHeight: 110 }}>
                    {hasBlocks && (
                      <div className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{ background: "repeating-linear-gradient(-45deg, #fee2e2, #fee2e2 3px, transparent 3px, transparent 10px)", opacity: 0.5 }} />
                    )}
                    <p className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full relative z-10 ${isToday ? "bg-[#3486cf] text-white" : "text-[#0F172A]"}`}>
                      {d.getDate()}
                    </p>
                    {dayBlocks.slice(0, 2).map((bl) => {
                      const blkMember = members.find((m) => m.id === bl.memberId)
                        || (bl.memberId === "__owner__" || !bl.memberId ? { id: "__owner__", name: ownerLabel, color: "#3486cf" } : { name: "", color: "#dc2626" });
                      const mc = bl.source === "google" ? (blkMember.color || "#dc2626") : "#dc2626";
                      const timeLabel = bl.allDay || (!bl.startTime && !bl.endTime) ? null : fmt12(bl.startTime);
                      return (
                        <button key={bl.id} type="button"
                          onClick={(e) => { e.stopPropagation(); setBlockDetail({ member: blkMember, blocks: [bl], date: d }); }}
                          className="text-xs px-1 py-0.5 rounded-xl mb-0.5 relative z-10 flex items-center gap-1 w-full text-left truncate group hover:opacity-80 transition-opacity"
                          style={{ background: hexWithAlpha(mc, 0.14), borderLeft: `2px solid ${mc}` }}>
                          {timeLabel && <span className="font-semibold flex-shrink-0" style={{ color: mc }}>{timeLabel}</span>}
                          <span className="font-medium truncate" style={{ color: mc }}>{blockLabel(bl, blkMember)}</span>
                        </button>
                      );
                    })}
                    {visibleDayEvents.slice(0, 3).map((ev) => {
                      const member = members.find((m) => m.id === ev.photographerId);
                      const color  = member?.color || "#0b2a55";
                      const t = ev.shootTime || ev.preferredTime;
                      const validTime = t && /^\d{1,2}:\d{2}/.test(t.trim());
                      const label = [validTime ? t.slice(0,5) : null, ev.clientName?.split(" ")[0]].filter(Boolean).join(" ");
                      return (
                        <button key={ev.id}
                          onClick={(e) => { e.stopPropagation(); setEventDetail({ ...ev, memberColor: color }); }}
                          style={{ background: color + "22", borderLeftColor: color }}
                          className="shoot-pill relative z-10 truncate w-full text-left hover:opacity-80 transition-opacity">
                          <span style={{ color }} className="font-medium">{label || ev.address?.split(",")[0]}</span>
                        </button>
                      );
                    })}
                    {visibleDayEvents.length > 3 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEventDetail({ ...visibleDayEvents[0], memberColor: members.find((m) => m.id === visibleDayEvents[0].photographerId)?.color || "#0b2a55" }); }}
                        className="text-xs text-[#3486cf] relative z-10 hover:underline">
                        +{visibleDayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DAY VIEW ───────────────────────────────────────────────────── */}
        {calView === "day" && (
          <div className="p-4">
            {/* Show photographers only vs. everyone */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
              <input type="checkbox" checked={availPhotographersOnly}
                onChange={(e) => setAvailPhotographersOnly(e.target.checked)}
                className="accent-[#3486cf]" />
              <span className="text-xs text-gray-500">Photographers only</span>
            </label>
            {/* All-Team blocks for this day */}
            {(() => {
              const dayStr = `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,"0")}-${String(anchor.getDate()).padStart(2,"0")}`;
              const allTeamDayBlocks = timeBlocks.filter((b) => {
                if (b.memberId) return false;
                const s = blockDateStr(b, "start");
                const e = blockDateStr(b, "end");
                return dayStr >= s && dayStr <= e;
              });
              if (allTeamDayBlocks.length === 0) return null;
              return (
                <div className="border border-red-200 rounded-xl overflow-hidden mb-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
                    <div className="w-4 h-4 rounded-full bg-red-400" />
                    <p className="text-sm font-semibold text-red-700">All Team — Blocked</p>
                  </div>
                  {allTeamDayBlocks.map((bl) => (
                    <div key={bl.id} className="px-4 py-2.5 border-b last:border-b-0 border-red-50 flex items-center justify-between bg-red-50/30">
                      <div>
                        <p className="text-xs font-semibold text-red-600">{bl.reason || "Blocked"}</p>
                        {(bl.startTime || bl.endTime) && (
                          <p className="text-xs text-red-400 mt-0.5">{fmt12(bl.startTime)}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}</p>
                        )}
                        {bl.note && <p className="text-xs text-red-400 mt-0.5">{bl.note}</p>}
                      </div>
                      <button onClick={() => deleteBlock(bl.id)} className="text-xs text-red-400 hover:text-red-600 font-medium ml-4">Remove</button>
                    </div>
                  ))}
                </div>
              );
            })()}
            {visibleMembers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No team members to display.</p>
            ) : (
              <div className="space-y-4">
                {visibleMembers.map((member) => {
                  const dayStr = `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,"0")}-${String(anchor.getDate()).padStart(2,"0")}`;
                  const memberEvents = calendarEvents.filter(
                    (e) => (e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email)) && isSameDay(e.shootDateObj, anchor)
                  );
                  const dayBlocks = timeBlocks.filter((b) => {
                    const startStr = blockDateStr(b, "start");
                            const endStr   = blockDateStr(b, "end");
                    return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                  });
                  const isBlocked = dayBlocks.length > 0;
                  return (
                    <div key={member.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                        <div className="w-4 h-4 rounded-full" style={{ background: member.color || "#0b2a55" }} />
                        <p className="text-sm font-semibold text-[#0F172A]">{member.name}</p>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                          isBlocked ? "bg-red-50 text-red-600" :
                          memberEvents.length > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                        }`}>
                          {isBlocked ? "Blocked" : memberEvents.length > 0 ? `${memberEvents.length} shoot${memberEvents.length !== 1 ? "s" : ""}` : "Available"}
                        </span>
                      </div>
                      {dayBlocks.map((bl) => (
                        <div key={bl.id} className="px-4 py-2 border-b flex items-center justify-between"
                          style={{ background: hexWithAlpha(member.color || "#0b2a55", 0.06), borderColor: hexWithAlpha(member.color || "#0b2a55", 0.15) }}>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: member.color || "#0b2a55" }}>{blockLabel(bl, member)}</p>
                            {(bl.startTime || bl.endTime) && (
                              <p className="text-xs" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.65) }}>{fmt12(bl.startTime)}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}</p>
                            )}
                            {bl.note && <p className="text-xs mt-0.5" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.6) }}>{bl.note}</p>}
                          </div>
                          <button onClick={() => deleteBlock(bl.id)} className="text-xs ml-3 font-medium"
                            style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.5) }}>Remove</button>
                        </div>
                      ))}
                      {memberEvents.length === 0 && !isBlocked ? (
                        // Non-shooting roles (managers/admins) don't get a
                        // "No shoots scheduled" line — it's noise for them.
                        shootsSchedule(member)
                          ? <p className="px-4 py-3 text-sm text-gray-400">No shoots scheduled for this day.</p>
                          : null
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {memberEvents.map((ev) => {
                            const color = member.color || "#0b2a55";
                            return (
                              <button key={ev.id}
                                onClick={() => setEventDetail({ ...ev, memberColor: color })}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group">
                                <div className="flex items-start gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#0F172A] truncate">{ev.fullAddress || ev.address}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{ev.clientName} · {ev.shootTime || ev.preferredTime || "Time TBD"}</p>
                                  </div>
                                  <span className="text-xs text-[#3486cf] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Details →</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT RAIL ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3" style={{ width: 260, flexShrink: 0 }}>

        {/* Mini-month */}
        {(() => {
          const mm_y = anchor.getFullYear(), mm_m = anchor.getMonth();
          const mm_firstDay = new Date(mm_y, mm_m, 1).getDay();
          const mm_daysInMonth = new Date(mm_y, mm_m + 1, 0).getDate();
          const mm_cells = [];
          for (let i = 0; i < mm_firstDay; i++) mm_cells.push(null);
          for (let d = 1; d <= mm_daysInMonth; d++) mm_cells.push(new Date(mm_y, mm_m, d));
          while (mm_cells.length % 7 !== 0) mm_cells.push(null);
          const anchorWeekStart = new Date(anchor);
          anchorWeekStart.setDate(anchor.getDate() - anchor.getDay());
          anchorWeekStart.setHours(0, 0, 0, 0);
          const anchorWeekEnd = new Date(anchorWeekStart);
          anchorWeekEnd.setDate(anchorWeekStart.getDate() + 6);
          anchorWeekEnd.setHours(23, 59, 59, 999);
          const weeks = [];
          for (let i = 0; i < mm_cells.length; i += 7) weeks.push(mm_cells.slice(i, i + 7));
          return (
            <div className="card-section overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <button onClick={prevPeriod} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#3486cf] rounded transition-colors">
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-semibold text-[#0F172A]">{MONTHS[mm_m].slice(0, 3)} {mm_y}</span>
                <button onClick={nextPeriod} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#3486cf] rounded transition-colors">
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="px-2 pt-2 pb-1">
                <div className="grid grid-cols-7 mb-1">
                  {DAYS_SHORT.map((d) => (
                    <div key={d} className="text-center text-[9px] font-semibold text-gray-300 uppercase">{d[0]}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => {
                  const weekHighlighted = week.some((d) => d && d >= anchorWeekStart && d <= anchorWeekEnd);
                  return (
                    <div key={wi} className={`grid grid-cols-7 rounded-lg ${weekHighlighted ? "bg-[#3486cf]/6" : ""}`}>
                      {week.map((d, di) => {
                        if (!d) return <div key={di} className="h-8" />;
                        const isT = isSameDay(d, today);
                        const cnt = calendarEvents.filter((e) => isSameDay(e.shootDateObj, d)).length;
                        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        const blk = timeBlocks.some((b) => {
                          const s = blockDateStr(b, "start"), e = blockDateStr(b, "end");
                          return ds >= s && ds <= e;
                        });
                        return (
                          <div key={di} onClick={() => setAnchor(new Date(d))}
                            className="h-8 flex flex-col items-center justify-center cursor-pointer rounded-lg">
                            <span className={`text-[11px] font-semibold leading-none ${isT ? "w-5 h-5 rounded-full bg-[#3486cf] text-white flex items-center justify-center" : "text-[#0F172A]"}`}>
                              {d.getDate()}
                            </span>
                            <div className="flex gap-0.5 mt-0.5 h-1.5">
                              {cnt > 0 && Array.from({ length: Math.min(cnt, 3) }).map((_, i) => (
                                <span key={i} className="w-1 h-1 rounded-full inline-block" style={{ background: "#3486cf" }} />
                              ))}
                              {blk && <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 px-3 py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#3486cf" }} /> Shoot
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Blocked
                </span>
              </div>
            </div>
          );
        })()}

        {/* Roster — sorted by this-week shoot count */}
        {activeMembers.length > 0 && (() => {
          const roster = activeMembers.map((m, i) => ({
            ...m,
            weekCount: calendarEvents.filter((e) =>
              (e.photographerId === m.id || e.photographerEmail === m.email) &&
              weekDates.some((d) => isSameDay(e.shootDateObj, d))
            ).length,
            zoneColor: ZONE_COLORS[i % ZONE_COLORS.length],
          })).sort((a, b) => b.weekCount - a.weekCount);
          return (
            <div className="card-section overflow-hidden">
              <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold text-[#0F172A]">Team — This Week</p>
              </div>
              <div>
                {roster.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-3 py-2"
                    style={{ opacity: m.weekCount === 0 ? 0.55 : 1, borderBottom: "1px solid var(--border-subtle)" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ fontSize: 8, background: m.zoneColor }}>
                      {initials(m.name).slice(0, 2)}
                    </div>
                    <p className="text-xs font-medium text-[#0F172A] truncate flex-1">{m.name}</p>
                    {m.weekCount > 0 && (
                      <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: "#3486cf" }}>{m.weekCount}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Unscheduled callout — hides when count = 0 */}
        {unscheduled.length > 0 && (
          <button onClick={() => switchTab("unscheduled")} className="w-full text-left overflow-hidden rounded-xl border"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(217,119,6,0.06) 100%)", borderColor: "#FCD34D" }}>
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-amber-800">Needs Scheduling</p>
                <span className="text-[10px] font-bold text-white bg-amber-500 rounded-full px-1.5 py-0.5 leading-tight">{unscheduled.length}</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                {unscheduled.length} booking{unscheduled.length !== 1 ? "s" : ""} waiting for a shoot date. Tap to review →
              </p>
            </div>
          </button>
        )}

      </div>
      </div>{/* end flex wrapper */}

      </div>}

      {/* Add/edit modal */}
      {editing && (
        <MemberForm
          member={editing === "new" ? null : editing}
          products={products}
          onSave={saveMember}
          onDelete={deleteMember}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Choice modal — how to add */}
      {addMode === "choice" && (
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={closeAddModal} />
          <div className="modal-card relative w-full max-w-sm">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="font-semibold text-[#0F172A] text-base">Add Team Member</h2>
              <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
            </div>
            <div className="p-5 space-y-3">
              <button onClick={() => setAddMode("invite")}
                className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#3486cf] hover:bg-[#3486cf]/5 transition-all text-left">
                <span className="text-2xl mt-0.5">📨</span>
                <div>
                  <p className="font-semibold text-[#0F172A] text-sm">Invite by Email</p>
                  <p className="text-xs text-gray-500 mt-0.5">They get an email link to create their account and join your team.</p>
                </div>
              </button>
              <button onClick={() => { closeAddModal(); setEditing("new"); }}
                className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#3486cf] hover:bg-[#3486cf]/5 transition-all text-left">
                <span className="text-2xl mt-0.5">📝</span>
                <div>
                  <p className="font-semibold text-[#0F172A] text-sm">Add Manually</p>
                  <p className="text-xs text-gray-500 mt-0.5">You enter their details yourself. No account or email required.</p>
                </div>
              </button>
            </div>
            <div className="px-6 py-3 flex justify-end" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={closeAddModal} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite by email modal */}
      {addMode === "invite" && (
        <div className="modal-backdrop">
          <div className="absolute inset-0" onClick={closeAddModal} />
          <div className="modal-card relative w-full max-w-md">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="font-semibold text-[#0F172A] text-base">Invite Team Member</h2>
              <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* Role selector */}
              <div>
                <label className="label-field">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button key={r.id} type="button"
                      onClick={() => setInviteForm((f) => ({ ...f, role: r.id, permissions: { ...DEFAULT_PERMISSIONS[r.id] } }))}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        inviteForm.role === r.id ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-gray-300"
                      }`}>
                      <span className="text-base leading-none">{r.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0F172A]">{r.label}</p>
                        <p className="text-[10px] text-gray-400">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {inviteForm.role === "custom" && (
                  <input
                    type="text"
                    value={inviteForm.customRoleTitle}
                    onChange={(e) => setInviteForm((f) => ({ ...f, customRoleTitle: e.target.value.slice(0, 40) }))}
                    placeholder="Custom role title (e.g. Coordinator, Editor)"
                    className="input-field w-full mt-2" />
                )}
                {DASHBOARD_ROLES.includes(inviteForm.role) ? (
                  <p className="text-xs text-purple-600 mt-1.5">→ Gets dashboard login access</p>
                ) : (
                  <p className="text-xs text-blue-600 mt-1.5">→ Gets photographer portal access</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="label-field">Email Address</label>
                <input type="email" value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  className="input-field w-full" placeholder="team@example.com" autoFocus />
              </div>

              {/* Permissions */}
              <div>
                <label className="label-field mb-2">Permissions</label>
                <div className="space-y-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2">
                  {PERMISSION_DEFS.map((perm) => (
                    <label key={perm.key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0F172A]">{perm.label}</p>
                        <p className="text-[11px] text-gray-400 leading-tight">{perm.desc}</p>
                      </div>
                      <button type="button"
                        onClick={() => setInviteForm((f) => ({ ...f, permissions: { ...f.permissions, [perm.key]: !f.permissions[perm.key] } }))}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${inviteForm.permissions[perm.key] ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${inviteForm.permissions[perm.key] ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              {inviteMsg && (
                <div className={`text-sm rounded-lg px-4 py-3 ${
                  inviteMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200"
                  : inviteMsg.startsWith("⚠") ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                  {inviteMsg}
                  {inviteUrl && (
                    <div className="mt-2 flex gap-2 items-center">
                      <code className="text-xs bg-white border border-amber-200 rounded px-2 py-1 flex-1 truncate">{inviteUrl}</code>
                      <button onClick={() => navigator.clipboard.writeText(inviteUrl)}
                        className="text-xs font-medium text-amber-700 border border-amber-300 px-2 py-1 rounded hover:bg-amber-100 flex-shrink-0">
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex justify-between items-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setAddMode("choice")} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
              <div className="flex gap-3">
                <button onClick={closeAddModal} className="btn-outline px-4 py-2 text-sm">Cancel</button>
                <button onClick={sendInvite} disabled={inviteSending || !inviteForm.email.trim()}
                  className="btn-primary px-6 py-2 text-sm">
                  {inviteSending ? "Sending…" : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owner calendar sync modal */}
      {showOwnerCalModal && (
        <OwnerCalSyncModal
          tenant={tenant}
          onClose={() => setShowOwnerCalModal(false)}
          onConnected={refreshTenant}
        />
      )}

      {/* Calendar sync modal */}
      {calModal && (
        <CalendarSyncModal
          member={calModal}
          onClose={() => setCalModal(null)}
          onDisconnect={(memberId) => {
            setMembers((prev) => prev.map((m) =>
              m.id === memberId ? { ...m, googleCalendar: null } : m
            ));
          }}
          onRegenerate={async () => {
            if (!window.confirm("Regenerate the calendar link? Any existing subscriptions will stop working.")) return;
            const token = await getToken();
            await fetch(`/api/dashboard/team/${calModal.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ regenerateCalendarToken: true }),
            });
            const res   = await fetch("/api/dashboard/team", { headers: { Authorization: `Bearer ${token}` } });
            const data  = await res.json();
            const updated = (data.members || []).find((m) => m.id === calModal.id);
            setMembers(data.members || []);
            if (updated) setCalModal(updated);
          }}
        />
      )}

      {/* Event detail popover */}
      {eventDetail && (
        <EventDetailPopover
          event={eventDetail}
          members={members}
          onClose={() => setEventDetail(null)}
        />
      )}

      {/* Block detail popover */}
      {blockDetail && (
        <div className="modal-backdrop" onClick={() => setBlockDetail(null)}>
          <div className="modal-card relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <p className="font-semibold text-[#0F172A] text-sm">
                  {blockDetail.member.name} — {DAYS_SHORT[blockDetail.date.getDay()]}, {MONTHS[blockDetail.date.getMonth()]} {blockDetail.date.getDate()}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">{blockDetail.blocks.length} event{blockDetail.blocks.length !== 1 ? "s" : ""} · unavailable</p>
              </div>
              <button onClick={() => setBlockDetail(null)} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">×</button>
            </div>
            <div className="p-5 space-y-3">
              {blockDetail.blocks.map((bl) => {
                const mc = blockDetail.member.color || "#0b2a55";
                const isGoogle = bl.source === "google";
                return (
                  <div key={bl.id} className="border rounded-lg p-3"
                    style={{ background: hexWithAlpha(mc, 0.06), borderColor: hexWithAlpha(mc, 0.2) }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold flex-1 min-w-0" style={{ color: mc }}>{bl.eventTitle || bl.reason || "Busy"}</p>
                      {!isGoogle && (
                        <button onClick={() => { deleteBlock(bl.id); setBlockDetail(null); }}
                          className="text-xs font-medium flex-shrink-0" style={{ color: hexWithAlpha(mc, 0.6) }}>Remove</button>
                      )}
                    </div>
                    {/* Time row — Google-Calendar style */}
                    <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: hexWithAlpha(mc, 0.7) }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                      </svg>
                      {bl.allDay || (!bl.startTime && !bl.endTime)
                        ? "All day"
                        : `${fmt12(bl.startTime)}${bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}`}
                    </p>
                    {/* Who */}
                    <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: hexWithAlpha(mc, 0.6) }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: mc }} />
                      {blockDetail.member.name}
                    </p>
                    {/* Source */}
                    <div className="mt-2 pt-2 flex items-center gap-1.5" style={{ borderTop: `1px solid ${hexWithAlpha(mc, 0.12)}` }}>
                      {isGoogle ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" className="flex-shrink-0"><rect width="24" height="24" rx="3" fill="#4285F4"/><rect x="5" y="6" width="14" height="13" rx="1.5" fill="white"/><rect x="5" y="6" width="14" height="3" fill="#4285F4"/></svg>
                          <span className="text-[10px]" style={{ color: hexWithAlpha(mc, 0.5) }}>Synced from Google Calendar</span>
                        </>
                      ) : (
                        <span className="text-[10px]" style={{ color: hexWithAlpha(mc, 0.5) }}>Manual block · {bl.startDate === bl.endDate ? "single day" : `${bl.startDate} – ${bl.endDate}`}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Block Time modal */}
      {showBlockModal && (
        <BlockTimeModal
          members={members}
          onSave={async (data) => {
            const ok = await createBlock(data);
            if (ok) setShowBlockModal(false);
          }}
          onClose={() => setShowBlockModal(false)}
          timeBlocks={timeBlocks}
          onDeleteBlock={deleteBlock}
        />
      )}
    </div>
  );
}
