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

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const creds = tenantDoc.data()?.cubiCasaCredentials;
  if (!creds?.email) {
    return Response.json({ error: "not_connected", message: "CubiCasa account not connected." }, { status: 403 });
  }

  const apiKey   = creds.apiKey.trim();
  const email    = creds.email.trim();
  const basicB64 = Buffer.from(`${email}:${apiKey}`).toString("base64");
  console.log(`[cubicasa/orders] key length=${apiKey.length} prefix=${apiKey.slice(0, 6)} email=${email}`);

  // CubiCasa v3 partner API — try multiple auth formats and endpoint names
  const attempts = [
    { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { Authorization: `Bearer ${apiKey}` } },
    { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { Authorization: `Basic ${basicB64}` } },
    { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { "X-Api-Key": apiKey } },
    { url: "https://app.cubi.casa/api/integrate/v3/orders", headers: { Authorization: `Bearer ${apiKey}` } },
    { url: "https://app.cubi.casa/api/integrate/v3/orders", headers: { Authorization: `Basic ${basicB64}` } },
    { url: "https://app.cubi.casa/api/integrate/v3/orders", headers: { "X-Api-Key": apiKey } },
  ];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        headers: { ...attempt.headers, "Content-Type": "application/json", Accept: "application/json" },
      });

      const text = await res.text();
      const isHtml = text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html");
      console.log(`[cubicasa/orders] ${attempt.url} auth=${Object.keys(attempt.headers)[0]} → status=${res.status} html=${isHtml} body=${text.slice(0, 300)}`);

      // HTML response means a redirect/login page — auth failed, try next format
      if (isHtml || res.status === 401 || res.status === 403) continue;

      if (!res.ok) {
        let errMsg = `CubiCasa ${res.status}`;
        try { const j = JSON.parse(text); errMsg = j.message || j.error || j.detail || JSON.stringify(j); } catch { errMsg = text.slice(0, 300) || errMsg; }
        return Response.json({ error: errMsg }, { status: res.status });
      }

      let data;
      try { data = JSON.parse(text); } catch {
        return Response.json({ error: `CubiCasa returned non-JSON: ${text.slice(0, 200)}` }, { status: 502 });
      }

      const raw    = Array.isArray(data) ? data : (data.scans ?? data.orders ?? data.data ?? data.results ?? []);
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
      console.error(`[cubicasa/orders] attempt failed:`, e?.message);
    }
  }

  return Response.json({ error: "CubiCasa rejected all authentication attempts. Check your API key." }, { status: 401 });
}

// DELETE — disconnect
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ cubiCasaCredentials: null });
  return Response.json({ ok: true });
}
