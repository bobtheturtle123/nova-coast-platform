// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL FEE
// Calculates drive distance from origin ZIP to the property address.
// Called server-side only (API route) — keeps API key secure.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} originZip           - photographer's home ZIP (e.g. "92108")
 * @param {string} destinationAddress  - full property address
 * @returns {Promise<number>} travel fee in dollars
 */
export async function getTravelFee(originZip, destinationAddress) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set — returning $0 travel fee");
    return 0;
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
      return 0;
    }

    const meters = element.distance.value;
    const miles  = meters / 1609.34;
    return calcFeeFromMiles(miles);
  } catch (err) {
    console.error("Travel fee fetch failed:", err);
    return 0;
  }
}

function calcFeeFromMiles(miles) {
  if (miles <= 15) return 0;
  if (miles <= 30) return 25;
  if (miles <= 50) return 50;
  if (miles <= 75) return 75;
  return Math.round(miles * 1.5);
}
