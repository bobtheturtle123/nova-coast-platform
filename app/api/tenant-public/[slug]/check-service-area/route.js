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

  const { address, lat: bLat, lng: bLng } = body;
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

  // Prefer pre-geocoded coords passed directly from the booking form
  const bodyLat = body.lat ? parseFloat(body.lat) : null;
  const bodyLng = body.lng ? parseFloat(body.lng) : null;

  let lat, lng;

  if (bodyLat != null && bodyLng != null && !isNaN(bodyLat) && !isNaN(bodyLng)) {
    lat = bodyLat;
    lng = bodyLng;
  } else {
    // Fall back to server-side geocoding (LocationIQ → Mapbox)
    const liqKey     = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
    const mapboxKey  = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    let geocoded     = false;

    if (liqKey) {
      try {
        const geoRes  = await fetch(
          `https://us1.locationiq.com/v1/search.php?key=${liqKey}&q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`
        );
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData[0]) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
          geocoded = true;
        }
      } catch { /* fall through to Mapbox */ }
    }

    if (!geocoded && mapboxKey) {
      try {
        const geoRes  = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxKey}&country=us&types=address&limit=1`
        );
        const geoData = await geoRes.json();
        const feature = geoData?.features?.[0];
        if (feature?.center) {
          [lng, lat] = feature.center;
          geocoded = true;
        }
      } catch { /* geocoding unavailable */ }
    }

    if (!geocoded) {
      return Response.json({
        covered: false,
        geocodeError: true,
        assignedPhotographers: [],
        zoneName: null,
        contact,
      });
    }
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
