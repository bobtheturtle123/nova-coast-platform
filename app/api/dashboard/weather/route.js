import { adminAuth } from "@/lib/firebase-admin";

// GET /api/dashboard/weather?address=...&date=YYYY-MM-DD
// Uses free APIs: Nominatim (geocoding) + Open-Meteo (weather/AQI)
// Returns: { temp, tempHigh, tempLow, description, uvIndex, aqi, windSpeed, precipitation, available }
export async function GET(req) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await adminAuth.verifyIdToken(token); // just auth check

    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const date    = searchParams.get("date"); // YYYY-MM-DD

    if (!address || !date) {
      return Response.json({ error: "address and date are required" }, { status: 400 });
    }

    // Check if date is within 16-day forecast window
    const shootDate = new Date(date + "T12:00:00");
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays  = Math.round((shootDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays > 16) {
      return Response.json({ available: false, reason: "too_far", daysOut: diffDays });
    }

    if (diffDays < 0) {
      return Response.json({ available: false, reason: "past", daysOut: diffDays });
    }

    // 1. Geocode address via Nominatim
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const geoRes  = await fetch(geoUrl, {
      headers: { "User-Agent": "NovaCoast-Platform/1.0" },
    });
    const geoData = await geoRes.json();

    if (!geoData?.length) {
      return Response.json({ available: false, reason: "geocode_failed" });
    }

    const { lat, lon } = geoData[0];

    // 2. Fetch weather from Open-Meteo (free, no key)
    const weatherUrl = [
      `https://api.open-meteo.com/v1/forecast`,
      `?latitude=${lat}&longitude=${lon}`,
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,windspeed_10m_max,weathercode`,
      `&hourly=uv_index`,
      `&current_weather=true`,
      `&temperature_unit=fahrenheit`,
      `&wind_speed_unit=mph`,
      `&precipitation_unit=inch`,
      `&timezone=auto`,
      `&forecast_days=16`,
    ].join("");

    // 3. Fetch AQI from Open-Meteo air quality (free, no key)
    const aqiUrl = [
      `https://air-quality-api.open-meteo.com/v1/air-quality`,
      `?latitude=${lat}&longitude=${lon}`,
      `&daily=us_aqi`,
      `&timezone=auto`,
      `&forecast_days=16`,
    ].join("");

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl).catch(() => null),
    ]);

    const weatherJson = await weatherRes.json();
    const aqiJson     = aqiRes ? await aqiRes.json().catch(() => null) : null;

    // Find the index for the requested date
    const dates = weatherJson.daily?.time || [];
    const idx   = dates.indexOf(date);

    if (idx === -1) {
      return Response.json({ available: false, reason: "date_not_in_forecast" });
    }

    const d         = weatherJson.daily;
    const tempHigh  = Math.round(d.temperature_2m_max[idx]);
    const tempLow   = Math.round(d.temperature_2m_min[idx]);
    const temp      = Math.round((tempHigh + tempLow) / 2);
    const uvIndex   = Math.round(d.uv_index_max[idx] ?? 0);
    const windSpeed = Math.round(d.windspeed_10m_max[idx] ?? 0);
    const precip    = d.precipitation_sum[idx] ?? 0;
    const wmoCode   = d.weathercode[idx] ?? 0;

    // AQI for the day
    const aqiIdx  = aqiJson?.daily?.time?.indexOf(date) ?? -1;
    const aqi     = aqiIdx >= 0 ? Math.round(aqiJson.daily.us_aqi[aqiIdx] ?? 0) : null;

    // Interpret WMO weather code into a description
    const description = wmoToDescription(wmoCode);
    const icon        = wmoToIcon(wmoCode);

    // AQI category
    const aqiLabel    = aqi !== null ? aqiCategory(aqi) : null;
    const uvLabel     = uvCategory(uvIndex);

    return Response.json({
      available:   true,
      date,
      lat:         parseFloat(lat),
      lon:         parseFloat(lon),
      temp,
      tempHigh,
      tempLow,
      description,
      icon,
      uvIndex,
      uvLabel,
      aqi,
      aqiLabel,
      windSpeed,
      precipitation: parseFloat(precip.toFixed(2)),
      daysOut:     diffDays,
    });
  } catch (err) {
    console.error("Weather API error:", err);
    return Response.json({ available: false, reason: "error", message: err.message }, { status: 500 });
  }
}

function wmoToDescription(code) {
  if (code === 0)               return "Clear sky";
  if (code <= 2)                return "Partly cloudy";
  if (code === 3)               return "Overcast";
  if (code <= 49)               return "Fog";
  if (code <= 55)               return "Drizzle";
  if (code <= 67)               return "Rain";
  if (code <= 77)               return "Snow";
  if (code <= 82)               return "Rain showers";
  if (code <= 86)               return "Snow showers";
  if (code <= 99)               return "Thunderstorm";
  return "Unknown";
}

function wmoToIcon(code) {
  if (code === 0)               return "☀️";
  if (code <= 2)                return "⛅";
  if (code === 3)               return "☁️";
  if (code <= 49)               return "🌫️";
  if (code <= 67)               return "🌧️";
  if (code <= 77)               return "❄️";
  if (code <= 82)               return "🌦️";
  if (code <= 99)               return "⛈️";
  return "🌡️";
}

function aqiCategory(aqi) {
  if (aqi <= 50)  return { label: "Good",        color: "text-green-600" };
  if (aqi <= 100) return { label: "Moderate",    color: "text-yellow-600" };
  if (aqi <= 150) return { label: "Unhealthy (sensitive)", color: "text-orange-500" };
  if (aqi <= 200) return { label: "Unhealthy",   color: "text-red-600" };
  return               { label: "Very unhealthy", color: "text-purple-700" };
}

function uvCategory(uv) {
  if (uv <= 2)  return { label: "Low",       color: "text-green-600" };
  if (uv <= 5)  return { label: "Moderate",  color: "text-yellow-600" };
  if (uv <= 7)  return { label: "High",      color: "text-orange-500" };
  if (uv <= 10) return { label: "Very High", color: "text-red-600" };
  return             { label: "Extreme",    color: "text-purple-700" };
}
