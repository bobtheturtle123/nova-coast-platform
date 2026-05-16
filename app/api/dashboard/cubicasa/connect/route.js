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
