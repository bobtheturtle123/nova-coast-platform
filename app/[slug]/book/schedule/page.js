"use client";

import { useState, useEffect } from "react";
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
  // "14:30" → "2:30 PM"
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export default function TenantSchedulePage() {
  const params = useRouter ? useParams() : {};
  const router = useRouter();
  const slug   = params.slug;

  const { preferredDate, preferredTime, setSchedule } = useBookingStore();

  const [slots,        setSlots]        = useState(null);   // null = loading, [] = none
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availMode,    setAvailMode]    = useState("slots"); // from config

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Load availability config once
  useEffect(() => {
    fetch(`/api/tenant-public/${slug}/catalog`)
      .then((r) => r.json())
      .then((data) => {
        const av = data.bookingConfig?.availability;
        if (av?.mode) setAvailMode(av.mode);
      })
      .catch(() => {});
  }, [slug]);

  // Reload slots whenever the selected date changes
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
    setSchedule({ preferredDate: iso, preferredTime: "" });
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

  const formattedDate = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  const canContinue = preferredDate && preferredTime;

  return (
    <>
      <StepProgress current={5} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">When works for you?</h1>
          <p className="font-body text-gray-500">
            Select a date and available time below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
          {/* Calendar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} disabled={isPrevDisabled}
                className={`p-1.5 rounded-sm transition-colors ${isPrevDisabled ? "text-gray-200 cursor-not-allowed" : "text-navy hover:bg-navy/5"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="font-semibold text-charcoal text-sm">{MONTHS[calMonth]} {calYear}</p>
              <button onClick={nextMonth} className="p-1.5 rounded-sm text-navy hover:bg-navy/5 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const cellDate = new Date(calYear, calMonth, day);
                cellDate.setHours(0, 0, 0, 0);
                const isPast     = cellDate < today;
                const isToday    = cellDate.getTime() === today.getTime();
                const isSelected = selectedYear === calYear && selectedMonth === calMonth && selectedDay === day;
                return (
                  <button key={day} onClick={() => selectDay(day)} disabled={isPast}
                    className={`relative mx-auto w-9 h-9 rounded-full text-sm transition-all duration-100 font-medium
                      ${isPast ? "text-gray-200 cursor-not-allowed" : "cursor-pointer"}
                      ${isSelected ? "bg-navy text-white shadow-sm"
                        : isToday  ? "border border-navy/30 text-navy hover:bg-navy/5"
                        : !isPast  ? "text-charcoal hover:bg-navy/8" : ""}`}>
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-navy/40" />
                    )}
                  </button>
                );
              })}
            </div>

            {formattedDate && (
              <p className="mt-4 text-xs text-center text-navy font-medium border-t border-gray-100 pt-3">
                {formattedDate}
              </p>
            )}
          </div>

          {/* Time slots */}
          <div>
            <p className="font-semibold text-charcoal text-sm uppercase tracking-wider mb-3">
              Available Times
            </p>

            {!preferredDate ? (
              <p className="text-sm text-gray-400">Select a date to see available times.</p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                Checking availability…
              </div>
            ) : slots && slots.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-700">
                No available times on this date. Please choose another day.
              </div>
            ) : slots ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((t) => (
                  <button key={t} type="button"
                    onClick={() => setSchedule({ preferredTime: t })}
                    className={`py-2.5 px-2 border rounded-sm text-sm font-medium text-center transition-all duration-150
                      ${preferredTime === t
                        ? "border-navy bg-navy text-white shadow-sm"
                        : "border-gray-200 text-charcoal hover:border-navy/30 hover:bg-gray-50"
                      }`}>
                    {formatTime12(t)}
                  </button>
                ))}
              </div>
            ) : null}

            {preferredTime && (
              <p className="text-xs text-navy font-medium mt-3">
                Selected: {formatTime12(preferredTime)} on {formattedDate}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-4">
              {availMode === "real"
                ? "Times shown reflect real availability. Your booking will be confirmed within 24 hours."
                : "Select your preferred time. We'll confirm via email within 24 hours."}
            </p>
          </div>
        </div>

        <div className="flex justify-between mt-8 max-w-3xl">
          <button onClick={() => router.push(`/${slug}/book/review`)} className="btn-outline">← Back</button>
          <button onClick={() => router.push(`/${slug}/book/payment`)} disabled={!canContinue}
            className="btn-primary px-12">
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
