import { adminAuth } from "@/lib/firebase-admin";

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate drive time from straight-line miles.
// Average driving speed assumption: 30 mph (accounts for stops, traffic, urban density).
function estimateDriveMinutes(miles) {
  return Math.ceil((miles / 30) * 60);
}

async function geocode(query) {
  if (!LOCATIONIQ_KEY) return null;
  if (typeof query === "object" && query.lat != null && query.lng != null) {
    return { lat: Number(query.lat), lng: Number(query.lng) };
  }
  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(String(query))}&format=json&limit=1&countrycodes=us`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// POST { origins: [{lat,lng} | "address string"], destinations: [{lat,lng} | "address string"] }
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { origins, destinations } = await req.json();
  if (!origins?.length || !destinations?.length) {
    return Response.json({ error: "origins and destinations required" }, { status: 400 });
  }

  // Geocode all unique points in parallel
  const [originCoords, destCoords] = await Promise.all([
    Promise.all(origins.map(geocode)),
    Promise.all(destinations.map(geocode)),
  ]);

  const rows = originCoords.map((orig, i) => ({
    origin: typeof origins[i] === "string" ? origins[i] : `${orig?.lat},${orig?.lng}`,
    elements: destCoords.map((dest, j) => {
      if (!orig || !dest) {
        return { status: "NOT_FOUND", destination: typeof destinations[j] === "string" ? destinations[j] : "" };
      }
      const miles          = haversineMiles(orig.lat, orig.lng, dest.lat, dest.lng);
      const durationMinutes = estimateDriveMinutes(miles);
      return {
        status:          "OK",
        destination:     typeof destinations[j] === "string" ? destinations[j] : `${dest.lat},${dest.lng}`,
        durationSeconds: durationMinutes * 60,
        durationMinutes,
        durationText:    `${durationMinutes} mins`,
        distanceText:    `${Math.round(miles * 10) / 10} mi`,
        hasTraffic:      false,
      };
    }),
  }));

  return Response.json({ rows });
}
