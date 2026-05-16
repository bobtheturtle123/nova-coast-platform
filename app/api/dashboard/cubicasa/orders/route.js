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

async function getApiKey(tenantId) {
  const doc  = await adminDb.collection("tenants").doc(tenantId).get();
  const creds = doc.data()?.cubiCasaCredentials;
  return creds?.apiKey || null;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getApiKey(ctx.tenantId);
  if (!apiKey) {
    return Response.json({ error: "not_connected", message: "CubiCasa account not connected." }, { status: 403 });
  }

  try {
    const res = await fetch("https://app.cubicasa.com/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept:        "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json({ error: "not_connected", message: "CubiCasa API key is invalid or expired." }, { status: 403 });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `CubiCasa API returned ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      console.error("[cubicasa/orders] non-JSON response:", text.slice(0, 300));
      return Response.json({ error: "CubiCasa returned an unexpected response. Check your API key." }, { status: 502 });
    }
    const orders = (Array.isArray(data) ? data : data.orders ?? data.data ?? []).map((o) => ({
      id:                         o.id ?? o.order_id ?? String(Math.random()),
      address:                    o.address ?? o.property_address ?? o.location ?? "",
      createdAt:                  o.created_at ?? o.createdAt ?? null,
      floorPlanUrl:               o.floor_plan_url ?? o.floorPlanUrl ?? o.image_url
                                    ?? o.files?.find((f) => f.type === "floor_plan")?.url ?? null,
      floorPlanWithDimensionsUrl: o.floor_plan_with_dimensions_url ?? o.floorPlanWithDimensionsUrl
                                    ?? o.files?.find((f) => f.type?.includes("dimension"))?.url ?? null,
    }));

    return Response.json(orders);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}

// DELETE — disconnect CubiCasa account
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ cubiCasaCredentials: null });
  return Response.json({ ok: true });
}
