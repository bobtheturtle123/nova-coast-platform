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

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function TenantSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const slug   = params.slug;

  const {
    preferredDate, preferredTime, twilightTime, photographerId,
    packageId, serviceIds,
    lat, lng,
    setSchedule,
  } = useBookingStore();

  const [slots,        setSlots]        = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availMode,    setAvailMode]    = useState("slots");
  const [workingDays,  setWorkingDays]  = useState(["mon","tue","wed","thu","fri"]);
  const [catalog,      setCatalog]      = useState(null);
  const [sunsetTime,   setSunsetTime]   = useState(null);
  const [sunsetLoading,setSunsetLoading]= useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Load catalog — availability config, photographer list, services
  useEffect(() => {
    fetch(`/api/tenant-public/${slug}/catalog`)
      .then((r) => r.json())
      .then((data) => {
        setCatalog(data);
        const av = data.bookingConfig?.availability;
        if (av?.mode) setAvailMode(av.mode);
        if (av?.businessHours?.days?.length) setWorkingDays(av.businessHours.days);
      })
      .catch(() => {});
  }, [slug]);

  // Is this a twilight booking?
  const isTwilightBooking = useMemo(() => {
    if (!catalog) return false;
    const selServices = (catalog.services || []).filter((s) => serviceIds.includes(s.id));
    const selPackage  = (catalog.packages || []).find((p) => p.id === packageId);
    // Also check services included inside the selected package
    const pkgIncludedServices = selPackage?.includes?.length
      ? (catalog.services || []).filter((s) => selPackage.includes.includes(s.id))
      : [];
    const all = [...selServices, ...(selPackage ? [selPackage] : []), ...pkgIncludedServices];
    return all.some((s) => s.isTwilight || s.name?.toLowerCase().includes("twilight"));
  }, [catalog, serviceIds, packageId]);

  // Fetch sunset time when date changes (only for twilight bookings with coordinates)
  useEffect(() => {
    if (!isTwilightBooking || !preferredDate) return;
    if (!lat || !lng) return;

    const offset = catalog?.bookingConfig?.availability?.twilightOffsetMinutes ?? 60;

    setSunsetLoading(true);
    setSunsetTime(null);
    fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${preferredDate}&formatted=0`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "OK") {
          const sunsetDt = new Date(data.results.sunset);
          const h = sunsetDt.getHours();
          const m = sunsetDt.getMinutes();
          const sunsetMin = h * 60 + m;
          const suggested = minutesToTime(sunsetMin - offset);
          setSunsetTime(suggested);
          // Only auto-set if user hasn't manually chosen
          if (!twilightTime) {
            setSchedule({ twilightTime: suggested });
          }
        }
      })
      .catch(() => {})
      .finally(() => setSunsetLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTwilightBooking, preferredDate, lat, lng]);

  // Reload slots when date changes
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

  const canContinue = preferredDate && preferredTime &&
    (!isTwilightBooking || twilightTime);

  const photographers = catalog?.photographers || [];

  return (
    <>
      <StepProgress current={5} />
      <div className="step-container">
        <div className="mb-8">
          <p className="section-label mb-2">Step 5 of 6</p>
          <h1 className="font-display text-4xl text-navy mb-3">When works for you?</h1>
          <p className="font-body text-gray-500">
            {isTwilightBooking
              ? "Select a date and two times — one for the daytime shoot and one for the twilight shoot."
              : "Select a date and available time below."}
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
                const DAY_KEYS  = ["sun","mon","tue","wed","thu","fri","sat"];
                const dayKey    = DAY_KEYS[cellDate.getDay()];
                const isPast     = cellDate < today;
                const isOffDay   = !workingDays.includes(dayKey);
                const isDisabled = isPast || isOffDay;
                const isToday    = cellDate.getTime() === today.getTime();
                const isSelected = selectedYear === calYear && selectedMonth === calMonth && selectedDay === day;
                return (
                  <button key={day} onClick={() => selectDay(day)} disabled={isDisabled}
                    className={`relative mx-auto w-9 h-9 rounded-full text-sm transition-all duration-100 font-medium
                      ${isDisabled ? "text-gray-200 cursor-not-allowed" : "cursor-pointer"}
                      ${isSelected ? "bg-navy text-white shadow-sm"
                        : isToday  ? "border border-navy/30 text-navy hover:bg-navy/5"
                        : !isDisabled ? "text-charcoal hover:bg-navy/8" : ""}`}>
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
          <div className="space-y-5">
            {/* Daytime slot */}
            <div>
              <p className="font-semibold text-charcoal text-sm uppercase tracking-wider mb-3">
                {isTwilightBooking ? "Daytime Shoot Time" : "Available Times"}
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
            </div>

            {/* Twilight time picker */}
            {isTwilightBooking && preferredDate && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-charcoal text-sm uppercase tracking-wider">Twilight Shoot Time</p>
                  <span className="text-xs text-amber-600 font-medium">🌅 Sunset-based</span>
                </div>

                {sunsetLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <span className="w-3 h-3 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                    Calculating sunset time…
                  </div>
                ) : sunsetTime ? (
                  <p className="text-xs text-gray-500 mb-2">
                    Sunset for this location: ~{formatTime12(sunsetTime)}
                    {catalog?.bookingConfig?.availability?.twilightOffsetMinutes
                      ? ` (default is ${catalog.bookingConfig.availability.twilightOffsetMinutes} min before sunset)`
                      : ""}
                  </p>
                ) : !lat || !lng ? (
                  <p className="text-xs text-amber-600 mb-2">
                    Use address autocomplete on the property step to auto-calculate sunset time.
                  </p>
                ) : null}

                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={twilightTime || sunsetTime || ""}
                    onChange={(e) => setSchedule({ twilightTime: e.target.value })}
                    className="input-field text-sm w-36"
                  />
                  {sunsetTime && (
                    <button type="button"
                      onClick={() => setSchedule({ twilightTime: sunsetTime })}
                      className="text-xs text-navy hover:underline">
                      Reset to sunset default
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Twilight shoots often run past normal business hours — this is expected.
                </p>
                {twilightTime && (
                  <p className="text-xs text-navy font-medium mt-2">
                    Twilight: {formatTime12(twilightTime)}
                  </p>
                )}
              </div>
            )}

            {preferredTime && !isTwilightBooking && (
              <p className="text-xs text-navy font-medium">
                Selected: {formatTime12(preferredTime)} on {formattedDate}
              </p>
            )}
            {preferredTime && isTwilightBooking && twilightTime && (
              <div className="bg-navy/5 rounded-sm px-3 py-2 text-xs text-navy font-medium space-y-0.5">
                <p>Daytime: {formatTime12(preferredTime)}</p>
                <p>Twilight: {formatTime12(twilightTime)}</p>
                <p className="text-navy/50 font-normal">{formattedDate}</p>
              </div>
            )}

            <p className="text-xs text-gray-400">
              {availMode === "real"
                ? "Times shown reflect real availability. Your booking will be confirmed within 24 hours."
                : "Select your preferred time. We'll confirm via email within 24 hours."}
            </p>
          </div>
        </div>

        {/* Photographer selection */}
        {photographers.length > 0 && (
          <div className="max-w-3xl mt-8">
            <p className="font-semibold text-charcoal text-sm uppercase tracking-wider mb-3">
              Preferred Photographer <span className="font-normal text-gray-400 normal-case text-xs">(optional)</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <button type="button"
                onClick={() => setSchedule({ photographerId: null })}
                className={`p-3 border rounded-sm text-center transition-colors ${
                  !photographerId ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-300"
                }`}>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2 text-gray-400 text-lg">
                  ?
                </div>
                <p className="text-xs font-medium text-gray-600">No preference</p>
              </button>
              {photographers.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => setSchedule({ photographerId: p.id })}
                  className={`p-3 border rounded-sm text-center transition-colors ${
                    photographerId === p.id ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name}
                      className="w-10 h-10 rounded-full object-cover mx-auto mb-2" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-white text-sm font-bold"
                      style={{ background: p.color || "#6B7280" }}>
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-medium text-charcoal truncate">{p.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

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
