// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL FEE
// Calculates drive distance from our base zip (92108) to the property.
// Called server-side only (API route) — keeps API key secure.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = "92108"; // Mission Valley, San Diego

/**
 * @param {string} destinationAddress - full property address
 * @returns {number} travel fee in dollars
 */
export async function getTravelFee(destinationAddress) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not set — returning $0 travel fee");
    return 0;
  }

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(ORIGIN)}` +
    `&destinations=${encodeURIComponent(destinationAddress)}` +
    `&units=imperial` +
    `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      console.error("Maps API error:", element?.status);
      return 0;
    }

    const meters = element.distance.value;
    const miles = meters / 1609.34;

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
  return Math.round(miles * 1.5); // $1.50/mile beyond 75mi
}
