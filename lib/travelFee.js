// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL FEE
// Calculates drive distance from origin ZIP to the property address.
// Called server-side only (API route) — keeps API key secure.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} originZip           - photographer's home ZIP (e.g. "92108")
 * @param {string} destinationAddress  - full property address
 * @param {object} [config]            - tenant travel fee config
 * @param {boolean} [config.enabled]   - if false, always return 0
 * @param {number}  [config.freeRadius]  - miles free before charging (default 20)
 * @param {number}  [config.ratePerMile] - dollars per mile beyond free radius (default 1.5)
 * @param {number}  [config.maxRadius]   - max service radius in miles (0 = unlimited)
 * @returns {Promise<{ fee: number, miles: number, withinRange: boolean }>}
 */
export async function getTravelFee(originZip, destinationAddress, config = {}) {
  const {
    enabled    = true,
    freeRadius = 20,
    ratePerMile = 1.5,
    maxRadius  = 0,
  } = config;

  if (!enabled) return { fee: 0, miles: 0, withinRange: true };

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set — returning $0 travel fee");
    return { fee: 0, miles: 0, withinRange: true };
  }

  const origin = originZip || process.env.NEXT_PUBLIC_FROM_ZIP || "92108";

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(origin)}` +
    `&destinations=${encodeURIComponent(destinationAddress)}` +
    `&units=imperial` +
    `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.error("Maps API error:", element?.status);
      return { fee: 0, miles: 0, withinRange: true };
    }

    const meters = element.distance.value;
    const miles  = Math.round((meters / 1609.34) * 10) / 10;

    // Check max service radius
    const withinRange = maxRadius <= 0 || miles <= maxRadius;

    const fee = calcFee(miles, freeRadius, ratePerMile);
    return { fee, miles, withinRange };
  } catch (err) {
    console.error("Travel fee fetch failed:", err);
    return { fee: 0, miles: 0, withinRange: true };
  }
}

function calcFee(miles, freeRadius, ratePerMile) {
  if (miles <= freeRadius) return 0;
  const billableMiles = miles - freeRadius;
  return Math.round(billableMiles * ratePerMile);
}
