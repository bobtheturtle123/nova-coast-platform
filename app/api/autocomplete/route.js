import { rateLimit } from "@/lib/rateLimit";

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;

// GET /api/autocomplete?q=123+Main+St
// Proxies LocationIQ autocomplete so the API key stays server-side only.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) return Response.json([]);

  const rl = await rateLimit(req, "autocomplete", 120, 3600);
  if (rl.limited) return Response.json([]);

  if (!LOCATIONIQ_KEY) return Response.json([]);

  try {
    const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(q)}&limit=6&countrycodes=us&dedupe=1&normalizecity=1&addressdetails=1`;
    const res  = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(Array.isArray(data) ? data.slice(0, 6) : []);
  } catch {
    return Response.json([]);
  }
}
