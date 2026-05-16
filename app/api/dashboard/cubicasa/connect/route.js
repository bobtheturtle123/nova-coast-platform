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

// POST { apiKey, email } — save CubiCasa credentials
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey, email } = await req.json();
  if (!apiKey || !email) {
    return Response.json({ error: "apiKey and email are required" }, { status: 400 });
  }

  // Validate the key works before saving by hitting a cheap endpoint
  const testRes = await fetch("https://app.cubicasa.com/api/v1/orders", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept:        "application/json",
    },
  });

  if (testRes.status === 401 || testRes.status === 403) {
    return Response.json({ error: "Invalid API key — CubiCasa rejected it." }, { status: 400 });
  }

  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    cubiCasaCredentials: { apiKey, email, connectedAt: Date.now() },
    cubiCasaToken: null, // clear old OAuth token if present
  });

  return Response.json({ ok: true });
}

// DELETE — disconnect
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    cubiCasaCredentials: null,
  });

  return Response.json({ ok: true });
}
