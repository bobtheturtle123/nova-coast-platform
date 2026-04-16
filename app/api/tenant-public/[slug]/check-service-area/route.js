import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Ray-casting point-in-polygon.
 * paths: [{lat, lng}, ...] — Google Maps polygon format
 */
function pointInPolygon(point, paths) {
  if (!paths || paths.length < 3) return false;
  const px = point.lng;
  const py = point.lat;
  let inside = false;
  const n = paths.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = paths[i].lng, yi = paths[i].lat;
    const xj = paths[j].lng, yj = paths[j].lat;
    if (((yi < py) !== (yj < py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export async function POST(req, { params }) {
  const { slug } = params;

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { address } = body;
  if (!address?.trim()) {
    return Response.json({ error: "Address is required" }, { status: 400 });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

  const contact = { phone: tenant.phone || "", email: tenant.email || "" };

  // If gate is disabled, skip check
  if (!tenant.bookingConfig?.requireServiceArea) {
    return Response.json({ covered: true, assignedPhotographers: [], zoneName: null, contact });
  }

  // Geocode the address
  const mapsKey = process.env.GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!mapsKey) {
    // Fail open — don't block bookings if key isn't configured
    console.warn("[check-service-area] No GOOGLE_MAPS_KEY configured; skipping zone check");
    return Response.json({ covered: true, assignedPhotographers: [], zoneName: null, contact });
  }

  let lat, lng;
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsKey}`
    );
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results?.[0]) {
      return Response.json({
        covered: false,
        geocodeError: true,
        assignedPhotographers: [],
        zoneName: null,
        contact,
      });
    }
    ({ lat, lng } = geoData.results[0].geometry.location);
  } catch (err) {
    console.error("[check-service-area] Geocode error:", err);
    return Response.json({ covered: true, assignedPhotographers: [], zoneName: null, contact });
  }

  // Load service zones
  const zonesSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("serviceAreas")
    .get();

  const zones = zonesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const includeZones = zones.filter((z) => z.type === "include" && z.paths?.length >= 3);
  const excludeZones = zones.filter((z) => z.type === "exclude" && z.paths?.length >= 3);

  // If no include zones are defined → no restriction, pass through
  if (includeZones.length === 0) {
    return Response.json({ covered: true, assignedPhotographers: [], zoneName: null, contact });
  }

  const point = { lat, lng };

  // Exclude zones take priority
  for (const zone of excludeZones) {
    if (pointInPolygon(point, zone.paths)) {
      return Response.json({
        covered: false,
        assignedPhotographers: [],
        zoneName: null,
        contact,
      });
    }
  }

  // Check include zones
  for (const zone of includeZones) {
    if (pointInPolygon(point, zone.paths)) {
      return Response.json({
        covered: true,
        assignedPhotographers: zone.assignedTo || [],
        zoneName: zone.name,
        contact,
      });
    }
  }

  // Not in any include zone
  return Response.json({
    covered: false,
    assignedPhotographers: [],
    zoneName: null,
    contact,
  });
}
