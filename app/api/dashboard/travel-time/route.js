import { adminAuth } from "@/lib/firebase-admin";

const MAPS_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST { origins: [{lat,lng} | "address string"], destinations: [{lat,lng} | "address string"] }
// Returns a matrix of travel times
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!MAPS_KEY) {
    return Response.json({ error: "Google Maps key not configured" }, { status: 503 });
  }

  const { origins, destinations } = await req.json();
  if (!origins?.length || !destinations?.length) {
    return Response.json({ error: "origins and destinations required" }, { status: 400 });
  }

  const fmt = (p) => {
    if (typeof p === "string") return encodeURIComponent(p);
    if (p?.lat != null && p?.lng != null) return `${p.lat},${p.lng}`;
    return encodeURIComponent(String(p));
  };

  const origStr  = origins.map(fmt).join("|");
  const destStr  = destinations.map(fmt).join("|");

  // Use departure_time=now for traffic-aware estimates (requires billing)
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origStr}` +
    `&destinations=${destStr}` +
    `&units=imperial` +
    `&departure_time=now` +
    `&traffic_model=best_guess` +
    `&key=${MAPS_KEY}`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    return Response.json({ error: "Maps API request failed" }, { status: 502 });
  }

  if (data.status !== "OK") {
    // Retry without traffic if departure_time not supported (e.g. free tier)
    const urlNoTraffic = `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origStr}&destinations=${destStr}&units=imperial&key=${MAPS_KEY}`;
    try {
      const res2 = await fetch(urlNoTraffic);
      data = await res2.json();
    } catch {
      return Response.json({ error: "Maps API unavailable" }, { status: 502 });
    }
  }

  if (data.status !== "OK") {
    return Response.json({ error: data.status || "Maps error", detail: data.error_message }, { status: 422 });
  }

  // Shape: rows[i].elements[j] = { status, duration, duration_in_traffic, distance }
  const rows = (data.rows || []).map((row, i) => ({
    origin: data.origin_addresses?.[i] || "",
    elements: (row.elements || []).map((el, j) => {
      if (el.status !== "OK") return { status: el.status, destination: data.destination_addresses?.[j] || "" };
      const durationSec = el.duration_in_traffic?.value ?? el.duration?.value ?? 0;
      return {
        status:          "OK",
        destination:     data.destination_addresses?.[j] || "",
        durationSeconds: durationSec,
        durationMinutes: Math.ceil(durationSec / 60),
        durationText:    el.duration_in_traffic?.text ?? el.duration?.text ?? "",
        distanceText:    el.distance?.text ?? "",
        hasTraffic:      !!el.duration_in_traffic,
      };
    }),
  }));

  return Response.json({ rows });
}
