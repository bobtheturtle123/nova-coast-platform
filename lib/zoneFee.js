// Per-zone / per-photographer travel fee resolution.
//
// Travel fees in "zones" mode are defined on each service-area zone as
// feeByPhotographer: { [memberId]: amount }. The fee charged depends on which
// photographer covers the matched zone:
//   - If a specific photographerId is known (e.g. dashboard booking), use their
//     fee for that zone.
//   - Otherwise (public booking, photographer not yet assigned), use the LOWEST
//     assigned photographer's fee so the client is never overcharged up front;
//     the tenant can adjust once the actual photographer is assigned.

import { adminDb } from "@/lib/firebase-admin";
import { geocode } from "@/lib/travelFee";

// Ray-casting point-in-polygon. paths: [{lat,lng}, ...]
function pointInPolygon(point, paths) {
  if (!paths || paths.length < 3) return false;
  const px = point.lng, py = point.lat;
  let inside = false;
  for (let i = 0, j = paths.length - 1; i < paths.length; j = i++) {
    const xi = paths[i].lng, yi = paths[i].lat;
    const xj = paths[j].lng, yj = paths[j].lat;
    if (((yi < py) !== (yj < py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Resolve the per-zone travel fee for an address. Returns
// { fee, zoneName, zoneId, covered }. fee is 0 when no matching zone or no
// fees are configured.
export async function getZoneTravelFee({ tenantId, lat, lng, address, photographerId } = {}) {
  let coords = (lat != null && lng != null) ? { lat: Number(lat), lng: Number(lng) } : null;
  if (!coords && address) coords = await geocode(address);
  if (!coords) return { fee: 0, zoneName: null, zoneId: null, covered: false };

  const snap = await adminDb.collection("tenants").doc(tenantId).collection("serviceAreas").get();
  const zones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Exclude zones win.
  for (const z of zones.filter((z) => z.type === "exclude" && z.paths?.length >= 3)) {
    if (pointInPolygon(coords, z.paths)) return { fee: 0, zoneName: null, zoneId: null, covered: false };
  }

  for (const z of zones.filter((z) => z.type === "include" && z.paths?.length >= 3)) {
    if (!pointInPolygon(coords, z.paths)) continue;
    const fees = z.feeByPhotographer || {};
    let fee = 0;
    if (photographerId && fees[photographerId] != null) {
      fee = Number(fees[photographerId]) || 0;
    } else {
      // Lowest assigned photographer fee (among assigned members with a value).
      const assigned = (z.assignedTo || []).filter((id) => fees[id] != null);
      const vals = (assigned.length ? assigned : Object.keys(fees))
        .map((id) => Number(fees[id]) || 0);
      fee = vals.length ? Math.min(...vals) : 0;
    }
    return { fee: Math.max(0, Math.round(fee)), zoneName: z.name || null, zoneId: z.id, covered: true };
  }

  return { fee: 0, zoneName: null, zoneId: null, covered: false };
}
