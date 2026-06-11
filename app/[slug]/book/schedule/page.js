"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function buildCalendar(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function formatTime12(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const P = "var(--color-primary, #3486cf)";
const A = "var(--color-accent, #c9a96e)";

export default function TenantSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const slug   = params.slug;

  const {
    preferredDate, preferredTime, twilightTime, photographerId,
    packageIds, serviceIds,
    lat, lng,
    address, city, state, zip,
    setSchedule,
  } = useBookingStore();

  const [slots,                   setSlots]                   = useState(null);
  const [slotsLoading,            setSlotsLoading]            = useState(false);
  const [availMode,               setAvailMode]               = useState("slots");
  const [workingDays,             setWorkingDays]             = useState(["mon","tue","wed","thu","fri"]);
  const [catalog,                 setCatalog]                 = useState(null);
  const [sunsetTime,              setSunsetTime]              = useState(null);
  const [sunsetLoading,           setSunsetLoading]           = useState(false);
  const [requireScheduleApproval, setRequireScheduleApproval] = useState(false);
  const [maxAdvanceDays,          setMaxAdvanceDays]          = useState(0);   // 0 = no limit
  const [minNoticeHours,          setMinNoticeHours]          = useState(0);
  // Local twilight input — only committed to store on explicit confirm so the panel doesn't
  // auto-jump while the user is still typing
  const [twilightInputVal,        setTwilightInputVal]        = useState(twilightTime || "");
  const [twilightConfirmed,       setTwilightConfirmed]       = useState(!!twilightTime);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Booking window bounds from tenant settings.
  // minDate: earliest bookable day (respects minimum-notice hours, rounded up to whole days).
  // maxDate: latest bookable day (maxAdvanceDays after today). 0 = no max.
  const minDate = useMemo(() => {
    const d = new Date(today);
    if (minNoticeHours > 0) d.setDate(d.getDate() + Math.ceil(minNoticeHours / 24));
    return d;
  }, [minNoticeHours]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxDate = useMemo(() => {
    if (!maxAdvanceDays || maxAdvanceDays <= 0) return null;
    const d = new Date(today);
    d.setDate(d.getDate() + maxAdvanceDays);
    return d;
  }, [maxAdvanceDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  useEffect(() => {
    fetch(`/api/tenant-public/${slug}/catalog`)
      .then((r) => r.json())
      .then((data) => {
        setCatalog(data);
        const av = data.bookingConfig?.availability;
        if (av?.mode) setAvailMode(av.mode);
        if (av?.businessHours?.days?.length) setWorkingDays(av.businessHours.days);
        if (data.bookingConfig?.requireScheduleApproval) setRequireScheduleApproval(true);
        if (av?.maxAdvanceDays != null) setMaxAdvanceDays(Number(av.maxAdvanceDays) || 0);
        if (av?.minNoticeHours != null) setMinNoticeHours(Number(av.minNoticeHours) || 0);
      })
      .catch(() => {});
  }, [slug]);

  const isTwilightBooking = useMemo(() => {
    if (!catalog) return false;
    const selServices = (catalog.services || []).filter((s) => serviceIds.includes(s.id));
    const selPackages = (catalog.packages || []).filter((p) => (packageIds || []).includes(p.id));
    const pkgIncludedServices = selPackages.flatMap((pkg) =>
      pkg.includes?.length ? (catalog.services || []).filter((s) => pkg.includes.includes(s.id)) : []
    );
    const all = [...selServices, ...selPackages, ...pkgIncludedServices];
    return all.some((s) => s.isTwilight || s.name?.toLowerCase().includes("twilight"));
  }, [catalog, serviceIds, packageIds]);

  useEffect(() => {
    if (!isTwilightBooking || !preferredDate) return;
    const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
    if (!lat && !lng && !fullAddress) return;

    setSunsetLoading(true);
    setSunsetTime(null);

    const qs = new URLSearchParams({ date: preferredDate });
    if (lat && lng) { qs.set("lat", lat); qs.set("lng", lng); }
    else if (fullAddress) { qs.set("address", fullAddress); }

    fetch(`/api/${slug}/sunset?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sunsetTime && data.suggestedTime) {
          setSunsetTime(data.sunsetTime);
          setTwilightInputVal(data.suggestedTime);
          setSchedule({ twilightTime: data.suggestedTime });
          setTwilightConfirmed(true);
        }
      })
      .catch(() => {})
      .finally(() => setSunsetLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTwilightBooking, preferredDate, lat, lng]);

  useEffect(() => {
    if (!preferredDate) { setSlots(null); return; }
    setSlotsLoading(true);
    setSlots(null);
    fetch(`/api/tenant-public/${slug}/availability?date=${preferredDate}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [preferredDate, slug]);

  const cells = buildCalendar(calYear, calMonth);

  let selectedYear = null, selectedMonth = null, selectedDay = null;
  if (preferredDate) {
    const [y, m, d] = preferredDate.split("-").map(Number);
    selectedYear = y; selectedMonth = m - 1; selectedDay = d;
  }

  function selectDay(day) {
    if (!day) return;
    const date = new Date(calYear, calMonth, day);
    date.setHours(0, 0, 0, 0);
    if (date < today) return;
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSchedule({ preferredDate: iso, preferredTime: "", twilightTime: null });
    setSunsetTime(null);
    setTwilightInputVal("");
    setTwilightConfirmed(false);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const isPrevDisabled = calYear === today.getFullYear() && calMonth <= today.getMonth();
  // Disable forward nav once the viewed month is at/after the month containing maxDate.
  const isNextDisabled = maxDate
    ? (calYear > maxDate.getFullYear() || (calYear === maxDate.getFullYear() && calMonth >= maxDate.getMonth()))
    : false;
  const formattedDate  = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  const canContinue = preferredDate && preferredTime && (!isTwilightBooking || twilightConfirmed);
  const photographers = catalog?.photographers || [];

  // Progressive right-panel step
  const rightStep = !preferredDate ? "idle"
    : !preferredTime ? "time"
    : isTwilightBooking && !twilightConfirmed ? "twilight"
    : "confirm";

  return (
    <div className="min-h-screen">
      <StepProgress current={4} />

      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* Page header */}
        <div className="pt-4 pb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-3xl font-semibold" style={{ color: P }}>
            When works for you?
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-body">
            {isTwilightBooking
              ? "Select a date, daytime, and twilight time below."
              : "Select a date and available time below."}
          </p>
        </div>

        {/* Two-panel */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">

          {/* ── Left: Calendar ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} disabled={isPrevDisabled}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                style={isPrevDisabled ? {} : { color: P }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="text-base font-semibold text-[#0F172A]">{MONTHS[calMonth]} {calYear}</p>
              <button onClick={nextMonth} disabled={isNextDisabled}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={isNextDisabled ? {} : { color: P }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-300 py-1 tracking-wide">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const cellDate = new Date(calYear, calMonth, day);
                cellDate.setHours(0, 0, 0, 0);
                const DAY_KEYS  = ["sun","mon","tue","wed","thu","fri","sat"];
                const dayKey    = DAY_KEYS[cellDate.getDay()];
                const isPast    = cellDate < today;
                const isOffDay  = !workingDays.includes(dayKey);
                const isBeforeMin = cellDate < minDate;
                const isAfterMax  = maxDate && cellDate > maxDate;
                const isDisabled = isPast || isOffDay || isBeforeMin || isAfterMax;
                const isToday   = cellDate.getTime() === today.getTime();
                const isSelected = selectedYear === calYear && selectedMonth === calMonth && selectedDay === day;

                return (
                  <button key={day} onClick={() => !isDisabled && selectDay(day)} disabled={isDisabled}
                    className={`relative mx-auto w-10 h-10 rounded-full text-sm transition-all duration-150 font-medium flex items-center justify-center
                      ${isDisabled ? "text-gray-200 cursor-not-allowed" : "cursor-pointer"}`}
                    style={
                      isSelected
                        ? { backgroundColor: P, color: "white" }
                        : isToday
                        ? { border: `1.5px solid color-mix(in srgb, ${P} 40%, transparent)`, color: P }
                        : !isDisabled
                        ? {}
                        : {}
                    }
                    onMouseEnter={(e) => { if (!isDisabled && !isSelected) e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${P} 8%, transparent)`; }}
                    onMouseLeave={(e) => { if (!isDisabled && !isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: P, opacity: 0.5 }} />
                    )}
                  </button>
                );
              })}
            </div>

            {formattedDate && (
              <p className="mt-5 text-xs text-center font-medium border-t border-gray-100 pt-4" style={{ color: P }}>
                {formattedDate}
              </p>
            )}
          </div>

          {/* ── Right: Progressive step panel ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div key={rightStep} className="animate-fade-up">

              {/* STEP: idle — no date picked */}
              {rightStep === "idle" && (
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-gray-50">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                      <rect x="3" y="4" width="18" height="18" rx="3"/>
                      <path d="M8 2v4M16 2v4M3 10h18"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-1">Pick a date</p>
                  <p className="text-xs text-gray-400 leading-relaxed">Select a date on the calendar to see available times.</p>
                </div>
              )}

              {/* STEP: time — pick a time slot */}
              {rightStep === "time" && (
                <div className="p-6">
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1">
                      {isTwilightBooking ? "Daytime" : "Available Times"}
                    </p>
                    <p className="text-base font-semibold text-[#0F172A]">{formattedDate}</p>
                  </div>

                  {slotsLoading ? (
                    <div className="flex items-center gap-2.5 py-8 justify-center">
                      <span className="w-4 h-4 border-2 rounded-full animate-spin border-gray-200" style={{ borderTopColor: P }} />
                      <span className="text-sm text-gray-400">Checking availability…</span>
                    </div>
                  ) : slots && slots.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                      No available times on this date. Please choose another day.
                    </div>
                  ) : slots ? (
                    <div className="space-y-2">
                      {slots.map((t) => (
                        <button key={t} type="button"
                          onClick={() => setSchedule({ preferredTime: t })}
                          className="w-full py-3.5 px-5 rounded-xl text-sm font-medium border text-center transition-all duration-150"
                          style={preferredTime === t
                            ? { borderColor: P, backgroundColor: P, color: "white" }
                            : { borderColor: "#e5e7eb", color: "#374151" }}
                          onMouseEnter={(e) => { if (preferredTime !== t) { e.currentTarget.style.borderColor = P; e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${P} 6%, transparent)`; } }}
                          onMouseLeave={(e) => { if (preferredTime !== t) { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.backgroundColor = "transparent"; } }}>
                          {formatTime12(t)}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {availMode !== "real" && slots?.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                      Select your preferred time. We&apos;ll confirm via email within 24 hours.
                    </p>
                  )}
                </div>
              )}

              {/* STEP: twilight — pick twilight time after daytime */}
              {rightStep === "twilight" && (() => {
                // Preset times spanning typical twilight windows (4:30 PM – 9:00 PM)
                const PRESETS = ["16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"];
                // If the API suggested time isn't in presets, add it so it's always selectable
                const shownPresets = (sunsetTime && !PRESETS.includes(twilightInputVal) && twilightInputVal)
                  ? [twilightInputVal, ...PRESETS]
                  : PRESETS;

                return (
                  <div className="p-6">
                    <button onClick={() => { setSchedule({ preferredTime: "", twilightTime: null }); setTwilightInputVal(""); setTwilightConfirmed(false); }}
                      className="text-xs text-gray-400 hover:text-gray-600 mb-5 flex items-center gap-1 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Change daytime
                    </button>

                    <div className="mb-4">
                      <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1">Twilight Shoot</p>
                      <p className="text-base font-semibold text-[#0F172A]">{formattedDate}</p>
                      <p className="text-sm text-gray-500 mt-0.5">Daytime: {formatTime12(preferredTime)}</p>
                    </div>

                    {sunsetLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                        <span className="w-3 h-3 border-2 rounded-full animate-spin border-gray-200" style={{ borderTopColor: P }} />
                        Looking up sunset time…
                      </div>
                    ) : sunsetTime ? (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-700 flex items-center gap-2">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1M12 20v1M4.22 4.22l.71.71M19.07 19.07l.71.71M1 12h1M22 12h1M4.22 19.78l.71-.71M19.07 4.93l.71-.71M17 12a5 5 0 11-10 0 5 5 0 0110 0z" />
                        </svg>
                        Sunset at {formatTime12(sunsetTime)} for this location
                      </div>
                    ) : null}

                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      When should twilight start?
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {PRESETS.map((t) => {
                        const isSelected = twilightInputVal === t;
                        const isSuggested = sunsetTime && t === twilightInputVal && !sunsetLoading;
                        return (
                          <button key={t} type="button"
                            onClick={() => setTwilightInputVal(t)}
                            className="py-2.5 px-3 rounded-xl text-sm font-medium border text-center transition-all duration-150 relative"
                            style={isSelected
                              ? { borderColor: P, backgroundColor: P, color: "white" }
                              : { borderColor: "#e5e7eb", color: "#374151" }}
                            onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = P; e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${P} 6%, transparent)`; } }}
                            onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.backgroundColor = "transparent"; } }}>
                            {formatTime12(t)}
                            {isSuggested && (
                              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400 text-white leading-none">
                                suggested
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!twilightInputVal}
                      onClick={() => {
                        setSchedule({ twilightTime: twilightInputVal });
                        setTwilightConfirmed(true);
                      }}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: P }}>
                      Confirm Time →
                    </button>
                  </div>
                );
              })()}

              {/* STEP: confirm */}
              {rightStep === "confirm" && (
                <div className="p-6">
                  <button onClick={() => {
                    if (isTwilightBooking) {
                      setTwilightConfirmed(false);
                    } else {
                      setSchedule({ preferredTime: "" });
                    }
                  }}
                    className="text-xs text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {isTwilightBooking ? "Change twilight time" : "Change time"}
                  </button>

                  {/* Summary */}
                  <div className="rounded-xl border border-gray-100 p-5 mb-6"
                    style={{ backgroundColor: `color-mix(in srgb, ${P} 4%, transparent)`, borderColor: `color-mix(in srgb, ${P} 20%, transparent)` }}>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${P} 12%, transparent)` }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: P }}>
                            <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Date</p>
                          <p className="text-sm font-semibold text-[#0F172A]">{formattedDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${P} 12%, transparent)` }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: P }}>
                            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                            {isTwilightBooking ? "Daytime" : "Time"}
                          </p>
                          <p className="text-sm font-semibold text-[#0F172A]">{formatTime12(preferredTime)}</p>
                        </div>
                      </div>
                      {isTwilightBooking && twilightTime && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1M12 20v1M4.22 4.22l.71.71M19.07 19.07l.71.71M1 12h1M22 12h1M4.22 19.78l.71-.71M19.07 4.93l.71-.71M17 12a5 5 0 11-10 0 5 5 0 0110 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Twilight</p>
                            <p className="text-sm font-semibold text-[#0F172A]">{formatTime12(twilightTime)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photographer preference — shown inline when feature is enabled */}
                  {photographers.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-3">
                        Preferred Photographer <span className="font-normal normal-case">(optional)</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {/* No preference */}
                        <button type="button"
                          onClick={() => setSchedule({ photographerId: null })}
                          className="p-3 border rounded-xl text-center transition-all"
                          style={!photographerId
                            ? { borderColor: P, backgroundColor: `color-mix(in srgb, ${P} 5%, transparent)` }
                            : { borderColor: "#e5e7eb" }}>
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-1.5">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="1.8">
                              <circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/>
                            </svg>
                          </div>
                          <p className="text-[10px] font-medium text-gray-400 leading-tight">No preference</p>
                        </button>
                        {photographers.map((p) => (
                          <button key={p.id} type="button"
                            onClick={() => setSchedule({ photographerId: p.id })}
                            className="p-3 border rounded-xl text-center transition-all"
                            style={photographerId === p.id
                              ? { borderColor: P, backgroundColor: `color-mix(in srgb, ${P} 5%, transparent)` }
                              : { borderColor: "#e5e7eb" }}>
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt={p.name} className="w-9 h-9 rounded-full object-cover mx-auto mb-1.5" />
                            ) : (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-1.5 text-white text-xs font-bold"
                                style={{ background: p.color || "#6B7280" }}>
                                {p.name?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <p className="text-[10px] font-medium text-[#0F172A] truncate">{p.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {requireScheduleApproval && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        <strong>Time not guaranteed.</strong> Our team will confirm your exact time within 24 hours.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => router.push(`/${slug}/book/review`)}
                    disabled={!canContinue}
                    className="btn-book-primary">
                    Continue to Review →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-8">
          <button onClick={() => router.push(`/${slug}/book/property`)} className="btn-outline">← Back</button>
        </div>
      </div>
    </div>
  );
}
