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

// POST { apiKey, email } — save per-tenant CubiCasa credentials
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { apiKey, email } = await req.json();
    if (!apiKey || !email) {
      return Response.json({ error: "API key and email are required" }, { status: 400 });
    }

    // Validate the credentials against CubiCasa before saving, so we never show
    // "connected" and then fail to load floor plans. CubiCasa's partner API
    // requires a real B2B integration agreement; a personal account API key
    // won't be accepted here.
    const key = apiKey.trim();
    const basicB64 = Buffer.from(`${email.trim()}:${key}`).toString("base64");
    const attempts = [
      { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { Authorization: `Bearer ${key}` } },
      { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { Authorization: `Basic ${basicB64}` } },
      { url: "https://app.cubi.casa/api/integrate/v3/scans",  headers: { "X-Api-Key": key } },
      { url: "https://app.cubi.casa/api/integrate/v3/orders", headers: { Authorization: `Bearer ${key}` } },
    ];
    let valid = false;
    for (const a of attempts) {
      try {
        const res  = await fetch(a.url, { headers: { ...a.headers, Accept: "application/json" } });
        const text = await res.text();
        const isHtml = text.trimStart().startsWith("<");
        if (!isHtml && res.ok) { valid = true; break; }
      } catch { /* try next */ }
    }
    if (!valid) {
      return Response.json({
        error: "Couldn't verify these CubiCasa credentials. The floor-plan API requires a CubiCasa Partner/Integration account (a personal account API key won't work). Contact CubiCasa to enable partner API access, then reconnect.",
      }, { status: 400 });
    }

    await adminDb.collection("tenants").doc(ctx.tenantId).update({
      cubiCasaCredentials: { apiKey, email, connectedAt: Date.now() },
      cubiCasaToken: null,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[cubicasa/connect] error:", e?.message || e);
    return Response.json({ error: "Failed to save credentials." }, { status: 500 });
  }
}

// DELETE — disconnect
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await adminDb.collection("tenants").doc(ctx.tenantId).update({ cubiCasaCredentials: null });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "Failed to disconnect." }, { status: 500 });
  }
}
