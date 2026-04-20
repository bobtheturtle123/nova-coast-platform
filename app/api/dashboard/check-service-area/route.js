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
    const { lat, lng } = await req.json();

    if (lat == null || lng == null) {
      return Response.json({ covered: true, zoneName: null, assignedPhotographers: [] });
    }

    const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
    const tenant    = tenantDoc.data() || {};

    // If service area gate is not enabled, everything is covered
    if (!tenant.bookingConfig?.requireServiceArea) {
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
