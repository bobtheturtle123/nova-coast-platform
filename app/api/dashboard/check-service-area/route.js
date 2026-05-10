import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

function pointInPolygon(point, paths) {
  if (!paths || paths.length < 3) return false;
  const px = point.lng, py = point.lat;
  let inside = false;
  const n = paths.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = paths[i].lng, yi = paths[i].lat;
    const xj = paths[j].lng, yj = paths[j].lat;
    if (((yi < py) !== (yj < py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { address } = body;

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data() || {};

    // If gate is disabled, skip entirely (no warning shown)
    if (!tenant.bookingConfig?.requireServiceArea) {
      return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
    }

    // Resolve lat/lng — prefer pre-geocoded coords from the autocomplete
    let lat = body.lat != null ? parseFloat(body.lat) : null;
    let lng = body.lng != null ? parseFloat(body.lng) : null;

    if ((lat == null || isNaN(lat)) && address?.trim()) {
      const liqKey    = process.env.LOCATIONIQ_KEY || process.env.NEXT_PUBLIC_LOCATIONIQ_KEY;
      const mapboxKey = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      let geocoded    = false;

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
        } catch { /* fall through */ }
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
        return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
      }
    }

    if (lat == null || isNaN(lat)) {
      return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
    }

    const zonesSnap = await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("serviceAreas").get();

    const zones        = zonesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const includeZones = zones.filter((z) => z.type === "include" && z.paths?.length >= 3);
    const excludeZones = zones.filter((z) => z.type === "exclude" && z.paths?.length >= 3);

    if (includeZones.length === 0) {
      return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
    }

    const point = { lat, lng };

    for (const zone of excludeZones) {
      if (pointInPolygon(point, zone.paths)) {
        return Response.json({ covered: false, zoneName: null, assignedPhotographers: [] });
      }
    }

    for (const zone of includeZones) {
      if (pointInPolygon(point, zone.paths)) {
        return Response.json({
          covered: true,
          zoneName: zone.name,
          assignedPhotographers: zone.assignedTo || [],
        });
      }
    }

    return Response.json({ covered: false, zoneName: null, assignedPhotographers: [] });
  } catch (err) {
    console.error("[dashboard/check-service-area]", err);
    return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
  }
}
