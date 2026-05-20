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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    if (!isTwilightBooking || !preferredDate || !lat || !lng) return;
    const offset = catalog?.bookingConfig?.availability?.twilightOffsetMinutes ?? 60;
    setSunsetLoading(true);
    setSunsetTime(null);
    fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${preferredDate}&formatted=0`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "OK") {
          const sunsetDt = new Date(data.results.sunset);
          const sunsetMin = sunsetDt.getHours() * 60 + sunsetDt.getMinutes();
          const suggested = minutesToTime(sunsetMin - offset);
          setSunsetTime(suggested);
          if (!twilightTime) setSchedule({ twilightTime: suggested });
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
  const formattedDate  = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  const canContinue = preferredDate && preferredTime && (!isTwilightBooking || twilightTime);
  const photographers = catalog?.photographers || [];

  // Progressive right-panel step
  const rightStep = !preferredDate ? "idle"
    : !preferredTime ? "time"
    : isTwilightBooking && !twilightTime ? "twilight"
    : "confirm";

  return (
    <div className="min-h-screen">
      <StepProgress current={5} />

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
              <button onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 transition-colors"
                style={{ color: P }}>
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
                const isDisabled = isPast || isOffDay;
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
              {rightStep === "twilight" && (
                <div className="p-6">
                  <button onClick={() => setSchedule({ preferredTime: "" })}
                    className="text-xs text-gray-400 hover:text-gray-600 mb-5 flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Change daytime
                  </button>

                  <div className="mb-5">
                    <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-1">🌅 Twilight Shoot</p>
                    <p className="text-base font-semibold text-[#0F172A]">{formattedDate}</p>
                    <p className="text-sm text-gray-500 mt-0.5">Daytime: {formatTime12(preferredTime)}</p>
                  </div>

                  {sunsetLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                      <span className="w-3 h-3 border-2 rounded-full animate-spin border-gray-200" style={{ borderTopColor: P }} />
                      Calculating sunset…
                    </div>
                  ) : sunsetTime ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 text-xs text-amber-700">
                      Suggested twilight time: <strong>{formatTime12(sunsetTime)}</strong>
                      {catalog?.bookingConfig?.availability?.twilightOffsetMinutes
                        ? ` (${catalog.bookingConfig.availability.twilightOffsetMinutes} min before sunset)`
                        : ""}
                    </div>
                  ) : (!lat || !lng) ? (
                    <p className="text-xs text-amber-600 mb-4">Use address autocomplete to auto-calculate sunset time.</p>
                  ) : null}

                  <label className="label-field">Twilight Start Time</label>
                  <input type="time"
                    value={twilightTime || sunsetTime || ""}
                    onChange={(e) => setSchedule({ twilightTime: e.target.value })}
                    className="input-field w-full mb-3" />

                  {sunsetTime && (
                    <button type="button"
                      onClick={() => setSchedule({ twilightTime: sunsetTime })}
                      className="text-xs font-medium hover:underline" style={{ color: P }}>
                      Reset to sunset default
                    </button>
                  )}
                </div>
              )}

              {/* STEP: confirm */}
              {rightStep === "confirm" && (
                <div className="p-6">
                  <button onClick={() => setSchedule({ preferredTime: "" })}
                    className="text-xs text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Change time
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
                            <span className="text-sm">🌅</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Twilight</p>
                            <p className="text-sm font-semibold text-[#0F172A]">{formatTime12(twilightTime)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                    onClick={() => router.push(`/${slug}/book/payment`)}
                    disabled={!canContinue}
                    className="btn-book-primary">
                    Continue to Payment →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photographer selection */}
        {photographers.length > 0 && (
          <div className="mt-8">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 mb-4">
              Preferred Photographer <span className="font-normal normal-case text-gray-300">(optional)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <button type="button"
                onClick={() => setSchedule({ photographerId: null })}
                className="p-4 border rounded-2xl text-center transition-all"
                style={!photographerId
                  ? { borderColor: P, backgroundColor: `color-mix(in srgb, ${P} 5%, transparent)` }
                  : { borderColor: "#e5e7eb" }}
                onMouseEnter={(e) => { if (photographerId) e.currentTarget.style.borderColor = "#d1d5db"; }}
                onMouseLeave={(e) => { if (photographerId) e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-400 text-lg">?</div>
                <p className="text-xs font-medium text-gray-500">No preference</p>
              </button>
              {photographers.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => setSchedule({ photographerId: p.id })}
                  className="p-4 border rounded-2xl text-center transition-all"
                  style={photographerId === p.id
                    ? { borderColor: P, backgroundColor: `color-mix(in srgb, ${P} 5%, transparent)` }
                    : { borderColor: "#e5e7eb" }}
                  onMouseEnter={(e) => { if (photographerId !== p.id) e.currentTarget.style.borderColor = "#d1d5db"; }}
                  onMouseLeave={(e) => { if (photographerId !== p.id) e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-full object-cover mx-auto mb-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-white text-sm font-bold"
                      style={{ background: p.color || "#6B7280" }}>
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-medium text-[#0F172A] truncate">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="mt-8">
          <button onClick={() => router.push(`/${slug}/book/review`)} className="btn-outline">← Back</button>
        </div>
      </div>
    </div>
  );
}
