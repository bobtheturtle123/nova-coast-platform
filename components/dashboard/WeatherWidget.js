"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";

// Props: address (string), date (YYYY-MM-DD string)
// Renders nothing if address or date is missing.
// Fetches /api/dashboard/weather and shows a compact forecast card.
export default function WeatherWidget({ address, date }) {
  const [weather,  setWeather]  = useState(null);   // null = not loaded
  const [loading,  setLoading]  = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!address?.trim() || !date) { setWeather(null); return; }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const params = new URLSearchParams({ address, date });
        const res = await fetch(`/api/dashboard/weather?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setWeather({ available: false, reason: "error" }); return; }
        setWeather(await res.json());
      } catch {
        setWeather({ available: false, reason: "error" });
      } finally {
        setLoading(false);
      }
    }, 700);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [address, date]);

  if (!address?.trim() || !date) return null;

  if (loading || (!weather && !loading)) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin flex-shrink-0" />
        Loading forecast…
      </div>
    );
  }

  if (!weather?.available) {
    const msg =
      weather?.reason === "too_far"
        ? `Forecast available within 16 days (${weather.daysOut} days out)`
        : weather?.reason === "past"
        ? "Shoot date has passed"
        : weather?.reason === "geocode_failed"
        ? "Could not locate address for forecast"
        : "Forecast unavailable";
    return (
      <div className="mt-3 text-xs text-gray-400 italic">{msg}</div>
    );
  }

  const { icon, description, temp, tempHigh, tempLow, tempUnit,
          uvIndex, uvLabel, aqi, aqiLabel, windSpeed, precipitation, daysOut } = weather;

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" role="img" aria-label={description}>{icon}</span>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{description}</p>
            <p className="text-xs text-gray-400">
              {daysOut === 0 ? "Today" : daysOut === 1 ? "Tomorrow" : `In ${daysOut} days`}
              {" · "}
              {address.split(",")[0]}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#0F172A] leading-none">{temp}°{tempUnit}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {tempHigh}° / {tempLow}°
          </p>
        </div>
      </div>

      {/* Detail row */}
      <div className="grid grid-cols-4 divide-x divide-gray-100 text-center">
        <Stat label="Wind" value={`${windSpeed} ${tempUnit === "C" ? "km/h" : "mph"}`} />
        <Stat label="Precip" value={`${precipitation}" ${tempUnit === "C" ? "mm" : "in"}`} />
        <Stat
          label="UV"
          value={uvIndex}
          sub={uvLabel?.label}
          color={uvLabel?.color}
        />
        {aqi !== null ? (
          <Stat
            label="AQI"
            value={aqi}
            sub={aqiLabel?.label}
            color={aqiLabel?.color}
          />
        ) : (
          <Stat label="AQI" value="—" />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="py-2.5 px-1">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-[#0F172A]">{value}</p>
      {sub && <p className={`text-[10px] font-medium ${color || "text-gray-500"}`}>{sub}</p>}
    </div>
  );
}
