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

async function getCredentials(tenantId) {
  const doc   = await adminDb.collection("tenants").doc(tenantId).get();
  const creds = doc.data()?.cubiCasaCredentials;
  if (!creds?.apiKey) return null;
  return creds; // { apiKey, email }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getCredentials(ctx.tenantId);
  if (!creds) {
    return Response.json({ error: "not_connected", message: "CubiCasa account not connected." }, { status: 403 });
  }

  try {
    const url = new URL("https://app.cubi.casa/api/integrate/v3/floor-plans");
    if (creds.email) url.searchParams.set("email", creds.email);

    const res = await fetch(url.toString(), {
      headers: {
        "X-API-KEY":    creds.apiKey,
        "Content-Type": "application/json",
        Accept:         "application/json",
      },
    });

    const text = await res.text();
    console.log(`[cubicasa/orders] status=${res.status} body=${text.slice(0, 1000)}`);

    if (!res.ok) {
      let errMsg = `CubiCasa ${res.status}`;
      try { const j = JSON.parse(text); errMsg = j.message || j.error || j.detail || JSON.stringify(j); } catch { errMsg = text.slice(0, 300) || errMsg; }
      return Response.json({ error: errMsg }, { status: res.status === 401 ? 403 : res.status });
    }

    let data;
    try { data = JSON.parse(text); } catch {
      return Response.json({ error: `CubiCasa returned non-JSON: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const raw    = Array.isArray(data) ? data : (data.orders ?? data.data ?? data.results ?? []);
    const orders = raw.map((o) => ({
      id:                         o.id ?? o.order_id ?? String(Math.random()),
      address:                    o.address ?? o.property_address ?? o.location ?? "",
      createdAt:                  o.created_at ?? o.createdAt ?? null,
      status:                     o.status ?? null,
      floorPlanUrl:               o.floor_plan_url ?? o.floorPlanUrl ?? o.image_url
                                    ?? o.files?.find((f) => f.type === "floor_plan")?.url
                                    ?? o.deliverables?.find((f) => f.type === "floor_plan")?.url ?? null,
      floorPlanWithDimensionsUrl: o.floor_plan_with_dimensions_url ?? o.floorPlanWithDimensionsUrl
                                    ?? o.files?.find((f) => f.type?.includes("dimension"))?.url
                                    ?? o.deliverables?.find((f) => f.type?.includes("dimension"))?.url ?? null,
    }));

    return Response.json(orders);
  } catch (e) {
    console.error("[cubicasa/orders] error:", e?.message || e);
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
