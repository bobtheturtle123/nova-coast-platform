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

const ALLOWED_TYPES = ["packages", "services", "addons"];

function sanitizeItem(body, type) {
  const base = {
    name:        (body.name || "").slice(0, 100),
    description: (body.description || "").slice(0, 1000),
    price:       Number(body.price) || 0,
    active:      body.active !== false,
    thumbnailUrl: body.thumbnailUrl || "",
    duration:    body.duration !== undefined ? Math.max(0, Math.round(Number(body.duration) || 0)) : undefined,
  };
  if (base.duration === undefined) delete base.duration;

  if (body.priceTiers && typeof body.priceTiers === "object") {
    base.priceTiers = {
      Tiny:   Number(body.priceTiers.Tiny)   || 0,
      Small:  Number(body.priceTiers.Small)  || 0,
      Medium: Number(body.priceTiers.Medium) || 0,
      Large:  Number(body.priceTiers.Large)  || 0,
      XL:     Number(body.priceTiers.XL)     || 0,
      XXL:    Number(body.priceTiers.XXL)    || 0,
    };
  }

  if (type === "packages") {
    base.tagline      = (body.tagline || "").slice(0, 200);
    base.deliverables = (body.deliverables || "").slice(0, 300);
    base.includes     = Array.isArray(body.includes) ? body.includes : [];
    base.featured     = !!body.featured;
  }

  return base;
}

// PATCH /api/dashboard/products/[id]?type=packages
export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!ALLOWED_TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });

  const body = await req.json();
  const item = { ...sanitizeItem(body, type), id: params.id };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type).doc(params.id)
    .set(item, { merge: true });

  return Response.json({ item });
}

// DELETE /api/dashboard/products/[id]?type=packages
export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!ALLOWED_TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type).doc(params.id)
    .delete();

  return Response.json({ ok: true });
}
