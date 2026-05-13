import { adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get("apiKey");
  if (!apiKey) return Response.json({ error: "apiKey is required" }, { status: 400 });

  try {
    const res = await fetch("https://api.cubicasa.com/v2/orders", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `CubiCasa API returned ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Normalize: return array of orders with id, address, createdAt, floorPlanUrl, floorPlanWithDimensionsUrl
    const orders = (Array.isArray(data) ? data : data.orders ?? data.data ?? []).map((o) => ({
      id:                          o.id ?? o.order_id ?? String(Math.random()),
      address:                     o.address ?? o.property_address ?? o.location ?? "",
      createdAt:                   o.created_at ?? o.createdAt ?? null,
      floorPlanUrl:                o.floor_plan_url ?? o.floorPlanUrl ?? o.image_url ?? o.files?.find((f) => f.type === "floor_plan")?.url ?? null,
      floorPlanWithDimensionsUrl:  o.floor_plan_with_dimensions_url ?? o.floorPlanWithDimensionsUrl ?? o.files?.find((f) => f.type?.includes("dimension"))?.url ?? null,
    }));

    return Response.json(orders);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
