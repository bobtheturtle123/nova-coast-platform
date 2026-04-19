// Travel fee calculation using LocationIQ geocoding + Haversine distance.
// Geocodes once per call — caller should pass lat/lng when known (e.g. from stored booking)
// to avoid any API call entirely.

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;

/**
 * Haversine straight-line distance between two lat/lng points, in miles.
 */
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

/**
 * Geocode an address or ZIP using LocationIQ. Returns { lat, lng } or null.
 */
async function geocode(query) {
  if (!LOCATIONIQ_KEY) return null;
  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * @param {string} originZip              - photographer's home ZIP
 * @param {string} destinationAddress     - full property address string
 * @param {object} [config]
 * @param {boolean} [config.enabled]
 * @param {number}  [config.freeRadius]   - miles free before charging (default 20)
 * @param {number}  [config.ratePerMile]  - dollars per mile beyond free radius (default 1.5)
 * @param {number}  [config.maxRadius]    - max service radius in miles (0 = unlimited)
 * @param {number}  [config.destLat]      - pre-known destination lat (skip geocoding)
 * @param {number}  [config.destLng]      - pre-known destination lng (skip geocoding)
 * @returns {Promise<{ fee: number, miles: number, withinRange: boolean }>}
 */
export async function getTravelFee(originZip, destinationAddress, config = {}) {
  const {
    enabled     = true,
    freeRadius  = 20,
    ratePerMile = 1.5,
    maxRadius   = 0,
    destLat,
    destLng,
  } = config;

  if (!enabled) return { fee: 0, miles: 0, withinRange: true };

  const origin = originZip || process.env.NEXT_PUBLIC_FROM_ZIP || "92108";

  const [originCoords, destCoords] = await Promise.all([
    geocode(origin),
    (destLat != null && destLng != null)
      ? Promise.resolve({ lat: destLat, lng: destLng })
      : geocode(destinationAddress),
  ]);

  if (!originCoords || !destCoords) {
    console.warn("[travelFee] Could not geocode origin or destination — returning $0");
    return { fee: 0, miles: 0, withinRange: true };
  }

  const miles = Math.round(
    haversineMiles(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng) * 10
  ) / 10;

  const withinRange = maxRadius <= 0 || miles <= maxRadius;
  const fee         = calcFee(miles, freeRadius, ratePerMile);

  return { fee, miles, withinRange };
}

function calcFee(miles, freeRadius, ratePerMile) {
  if (miles <= freeRadius) return 0;
  return Math.round((miles - freeRadius) * ratePerMile);
}
