import { getTenantBySlug } from "@/lib/tenants";

function pad(n) { return String(n).padStart(2, "0"); }
function minToTime(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);
  const date    = searchParams.get("date");
  const address = searchParams.get("address"); // full address string (fallback when no coords)
  let   lat     = parseFloat(searchParams.get("lat")) || null;
  let   lng     = parseFloat(searchParams.get("lng")) || null;

  if (!date) return Response.json({ error: "Missing date" }, { status: 400 });

  // Geocode from address if coordinates not available (user skipped autocomplete)
  if ((!lat || !lng) && address) {
    try {
      const geoData = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { "User-Agent": "ShootFlow/1.0 booking-app" } }
      ).then((r) => r.json());
      if (geoData?.[0]) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }
    } catch { /* fall through */ }
  }

  if (!lat || !lng) {
    return Response.json({ error: "Could not resolve location" }, { status: 422 });
  }

  try {
    const tenant = await getTenantBySlug(params.slug);
    const offset = tenant?.bookingConfig?.availability?.twilightOffsetMinutes ?? 60;

    const [sunRes, tzRes] = await Promise.all([
      fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`)
        .then((r) => r.json()),
      fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lng}`)
        .then((r) => r.json()).catch(() => null),
    ]);

    if (sunRes.status !== "OK") {
      return Response.json({ error: "Sunset lookup failed" }, { status: 502 });
    }

    const sunsetUtc = new Date(sunRes.results.sunset);
    let sunsetMin;

    if (tzRes?.timeZone) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tzRes.timeZone,
        hour:     "numeric",
        minute:   "numeric",
        hour12:   false,
      }).formatToParts(sunsetUtc);
      const h = Number(parts.find((p) => p.type === "hour")?.value   ?? 0);
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      sunsetMin = h * 60 + m;
    } else {
      sunsetMin = sunsetUtc.getUTCHours() * 60 + sunsetUtc.getUTCMinutes();
    }

    const suggestedMin = Math.max(0, sunsetMin - offset);

    return Response.json({
      sunsetTime:    minToTime(sunsetMin),
      suggestedTime: minToTime(suggestedMin),
      timezone:      tzRes?.timeZone || null,
      offset,
    });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
