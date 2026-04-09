"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepProgress from "@/components/booking/StepProgress";

const DAYS    = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TIME_SLOTS = [
  { value: "morning",   label: "Morning",   desc: "8 am – 12 pm" },
  { value: "afternoon", label: "Afternoon", desc: "12 pm – 5 pm" },
  { value: "flexible",  label: "Flexible",  desc: "Any time works" },
];

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function TenantSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { preferredDate, preferredTime, setSchedule } = useBookingStore();

  const today     = new Date();
  today.setHours(0,0,0,0);

  // Calendar navigation state
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const cells = buildCalendar(calYear, calMonth);

  // Derive selected day from store value
  let selectedYear = null, selectedMonth = null, selectedDay = null;
  if (preferredDate) {
    const [y, m, d] = preferredDate.split("-").map(Number);
    selectedYear = y; selectedMonth = m - 1; selectedDay = d;
  }

  function selectDay(day) {
    if (!day) return;
    const date = new Date(calYear, calMonth, day);
    date.setHours(0,0,0,0);
    if (date < today) return; // past date
    const iso = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    setSchedule({ preferredDate: iso });
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  // Disable navigating to past months
  const isPrevDisabled = calYear === today.getFullYear() && calMonth <= today.getMonth();

  const formattedDate = preferredDate
    ? new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <>
      <StepProgress current={5} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">When works for you?</h1>
          <p className="font-body text-gray-500">
            We'll confirm availability within 24 hours and lock in an exact time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
          {/* Calendar */}
          <div className="card">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                disabled={isPrevDisabled}
                className={`p-1.5 rounded-sm transition-colors ${
                  isPrevDisabled
                    ? "text-gray-200 cursor-not-allowed"
                    : "text-navy hover:bg-navy/5"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <p className="font-semibold text-charcoal text-sm">
                {MONTHS[calMonth]} {calYear}
              </p>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-sm text-navy hover:bg-navy/5 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;

                const cellDate = new Date(calYear, calMonth, day);
                cellDate.setHours(0,0,0,0);
                const isPast     = cellDate < today;
                const isToday    = cellDate.getTime() === today.getTime();
                const isSelected = selectedYear === calYear && selectedMonth === calMonth && selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => selectDay(day)}
                    disabled={isPast}
                    className={`
                      relative mx-auto w-9 h-9 rounded-full text-sm transition-all duration-100 font-medium
                      ${isPast        ? "text-gray-200 cursor-not-allowed" : "cursor-pointer"}
                      ${isSelected    ? "bg-navy text-white shadow-sm"
                        : isToday     ? "border border-navy/30 text-navy hover:bg-navy/5"
                        : !isPast     ? "text-charcoal hover:bg-navy/8"
                        : ""}
                    `}
                  >
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

          {/* Time preference */}
          <div className="space-y-3">
            <p className="font-semibold text-charcoal text-sm uppercase tracking-wider">Preferred Time</p>
            {TIME_SLOTS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSchedule({ preferredTime: t.value })}
                className={`w-full p-4 border rounded-sm text-left transition-all duration-150
                  ${preferredTime === t.value
                    ? "border-navy bg-navy/5 shadow-sm"
                    : "border-gray-200 hover:border-navy/30 hover:bg-gray-50"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-semibold text-sm ${preferredTime === t.value ? "text-navy" : "text-charcoal"}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                    {t.note && (
                      <p className="text-xs text-gold-dark mt-0.5 font-medium">{t.note}</p>
                    )}
                  </div>
                  {preferredTime === t.value && (
                    <div className="w-4 h-4 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}

            <p className="text-xs text-gray-400 pt-1">
              Exact shoot time will be confirmed via email after booking.
            </p>
          </div>
        </div>

        <div className="flex justify-between mt-8 max-w-3xl">
          <button onClick={() => router.push(`/${params.slug}/book/review`)} className="btn-outline">← Back</button>
          <button
            onClick={() => router.push(`/${params.slug}/book/payment`)}
            disabled={!preferredDate}
            className="btn-primary px-12"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
