import { adminAuth, adminDb } from "@/lib/firebase-admin";

// GET  — fetch current custom domain config
// POST — save/update custom domain
// DELETE — remove custom domain

async function getTenant(req) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, decoded };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getTenant(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const customDomain = doc.data()?.customDomain || null;
  return Response.json({ customDomain });
}

export async function POST(req) {
  const ctx = await getTenant(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) return Response.json({ error: "domain required" }, { status: 400 });

  // Basic domain validation
  const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(clean)) {
    return Response.json({ error: "Invalid domain format. Use: yourdomain.com or sub.yourdomain.com" }, { status: 400 });
  }

  // Check domain isn't already claimed by another tenant
  const existing = await adminDb.collection("tenants")
    .where("customDomain.domain", "==", clean)
    .limit(1)
    .get();

  if (!existing.empty && existing.docs[0].id !== ctx.tenantId) {
    return Response.json({ error: "This domain is already in use." }, { status: 409 });
  }

  const customDomain = {
    domain:    clean,
    verified:  false,
    addedAt:   new Date().toISOString(),
  };

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ customDomain });
  return Response.json({ customDomain });
}

export async function DELETE(req) {
  const ctx = await getTenant(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    customDomain: null,
  });
  return Response.json({ ok: true });
}
