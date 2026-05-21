import { rateLimit } from "@/lib/rateLimit";

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
const MAPBOX_TOKEN   = process.env.MAPBOX_TOKEN   || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function normalizeNominatim(item) {
  const a = item.address || {};
  return {
    display_name: item.display_name,
    lat: item.lat  ? String(item.lat)  : null,
    lon: item.lon  ? String(item.lon)  : null,
    address: {
      house_number: a.house_number || "",
      road:         a.road || a.pedestrian || "",
      city:         a.city || a.town || a.village || a.county || "",
      state:        a.state || "",
      postcode:     a.postcode || "",
      country:      a.country || "",
    },
  };
}

function hasHouseNumber(result) {
  return !!(result.address?.house_number || result.display_name?.match(/^\d/));
}

// Deduplicate by lat/lng proximity (within ~50m)
function dedupe(results) {
  const seen = [];
  return results.filter((r) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (isNaN(lat) || isNaN(lon)) return true;
    const duplicate = seen.some(
      (s) => Math.abs(s.lat - lat) < 0.0005 && Math.abs(s.lon - lon) < 0.0005
    );
    if (!duplicate) seen.push({ lat, lon });
    return !duplicate;
  });
}

async function queryLocationIQ(q) {
  if (!LOCATIONIQ_KEY) return [];
  try {
    const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=8&countrycodes=us&dedupe=1&normalizecity=1&normalizeaddress=1&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function queryNominatim(q) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=us&limit=6`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ShootFlow/1.0 booking-app" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeNominatim) : [];
  } catch { return []; }
}

async function queryMapbox(q) {
  if (!MAPBOX_TOKEN) return [];
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address&autocomplete=true&limit=6`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f) => {
      const ctx      = f.context || [];
      const place    = ctx.find((c) => c.id?.startsWith("place"))?.text    || "";
      const region   = ctx.find((c) => c.id?.startsWith("region"))?.text   || "";
      const postcode = ctx.find((c) => c.id?.startsWith("postcode"))?.text || "";
      const country  = ctx.find((c) => c.id?.startsWith("country"))?.text  || "";
      const [lng, lat] = f.center || [null, null];
      return {
        display_name: f.place_name,
        lat: lat ? String(lat) : null,
        lon: lng ? String(lng) : null,
        address: {
          house_number: f.address || "",
          road:         f.text    || "",
          city:         place,
          state:        region,
          postcode,
          country,
        },
      };
    });
  } catch { return []; }
}

// GET /api/autocomplete?q=123+Main+St
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json([]);

  const rl = await rateLimit(req, "autocomplete", 120, 3600);
  if (rl.limited) return Response.json([]);

  const startsWithNum = /^\d/.test(q);

  // Run LocationIQ + Nominatim in parallel — both have good US coverage
  const [liqResults, nomResults] = await Promise.all([
    queryLocationIQ(q),
    queryNominatim(q),
  ]);

  let merged = [...liqResults, ...nomResults];

  // If both are empty, try Mapbox as last resort
  if (merged.length === 0) {
    merged = await queryMapbox(q);
  }

  // Deduplicate by proximity
  merged = dedupe(merged);

  // When query starts with a number, bubble results with house numbers to top
  if (startsWithNum) {
    merged.sort((a, b) => {
      const aHas = hasHouseNumber(a) ? 1 : 0;
      const bHas = hasHouseNumber(b) ? 1 : 0;
      return bHas - aHas;
    });
  }

  return Response.json(merged.slice(0, 6));
}
