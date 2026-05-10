import { rateLimit } from "@/lib/rateLimit";

const LOCATIONIQ_KEY  = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
// Prefer server-side key (not exposed in browser bundle); fall back to public key for backwards compat
const MAPBOX_TOKEN    = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// GET /api/autocomplete?q=123+Main+St
// Proxies address autocomplete so API keys stay server-side only.
// Prefers LocationIQ; falls back to Mapbox when LocationIQ key is absent.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) return Response.json([]);

  const rl = await rateLimit(req, "autocomplete", 120, 3600);
  if (rl.limited) return Response.json([]);

  // ── LocationIQ path ───────────────────────────────────────────────────────
  if (LOCATIONIQ_KEY) {
    try {
      const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=6&countrycodes=us&dedupe=1&normalizecity=1&addressdetails=1`;
      const res  = await fetch(url, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return Response.json(data.slice(0, 6));
      }
    } catch { /* fall through to Mapbox */ }
  }

  // ── Mapbox fallback ───────────────────────────────────────────────────────
  if (!MAPBOX_TOKEN) return Response.json([]);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address&autocomplete=true&limit=6`;
    const res  = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return Response.json([]);
    const data = await res.json();

    // Normalize Mapbox GeoJSON features → LocationIQ-compatible shape
    const results = (data.features || []).map((f) => {
      const ctx       = f.context || [];
      const place     = ctx.find((c) => c.id?.startsWith("place"))?.text     || "";
      const region    = ctx.find((c) => c.id?.startsWith("region"))?.text    || "";
      const postcode  = ctx.find((c) => c.id?.startsWith("postcode"))?.text  || "";
      const country   = ctx.find((c) => c.id?.startsWith("country"))?.text   || "";
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

    return Response.json(results);
  } catch {
    return Response.json([]);
  }
}
