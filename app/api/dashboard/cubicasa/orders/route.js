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

async function getAccessToken(tenantId) {
  const doc  = await adminDb.collection("tenants").doc(tenantId).get();
  const data = doc.data();
  const tok  = data?.cubiCasaToken;
  if (!tok?.accessToken) return null;

  // If token expires within 5 min, refresh it
  if (tok.refreshToken && tok.expiresAt && tok.expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const res = await fetch("https://app.cubicasa.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          refresh_token: tok.refreshToken,
          client_id:     process.env.CUBICASA_CLIENT_ID,
          client_secret: process.env.CUBICASA_CLIENT_SECRET,
        }),
      });
      if (res.ok) {
        const newTok = await res.json();
        const updated = {
          accessToken:  newTok.access_token,
          refreshToken: newTok.refresh_token || tok.refreshToken,
          expiresAt:    Date.now() + (newTok.expires_in || 3600) * 1000,
          connectedAt:  tok.connectedAt,
        };
        await adminDb.collection("tenants").doc(tenantId).update({ cubiCasaToken: updated });
        return updated.accessToken;
      }
    } catch { /* fall through and try existing token */ }
  }

  return tok.accessToken;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getAccessToken(ctx.tenantId);
  if (!accessToken) {
    return Response.json({ error: "not_connected", message: "CubiCasa account not connected." }, { status: 403 });
  }

  try {
    const res = await fetch("https://app.cubicasa.com/api/v1/orders", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept:        "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `CubiCasa API returned ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data   = await res.json();
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

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ cubiCasaToken: null });
  return Response.json({ ok: true });
}
