import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { stripTags } from "@/lib/rateLimit";

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

// GET /api/dashboard/products?type=packages
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!ALLOWED_TYPES.includes(type)) {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type)
    .get();

  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Response.json({ items });
}

// POST /api/dashboard/products?type=packages  — create new item
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type");
  if (!ALLOWED_TYPES.includes(type)) {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  const body = await req.json();
  const id   = body.id || uuidv4().replace(/-/g, "").slice(0, 16);

  const item = sanitizeItem(body, type);
  item.id = id;

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type).doc(id)
    .set(item);

  return Response.json({ item });
}

function sanitizeItem(body, type) {
  const base = {
    name:         stripTags(body.name        || "").slice(0, 100),
    description:  stripTags(body.description || "").slice(0, 1000),
    price:        Number(body.price) || 0,
    active:       body.active !== false,
    thumbnailUrl: typeof body.thumbnailUrl === "string" && body.thumbnailUrl.startsWith("https://")
      ? body.thumbnailUrl.slice(0, 500)
      : "",
    duration:     body.duration !== undefined ? Math.max(0, Math.round(Number(body.duration) || 0)) : undefined,
  };
  if (base.duration === undefined) delete base.duration;

  // Tier pricing — all numeric, no injection risk
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

  // Package-specific
  if (type === "packages") {
    base.tagline      = stripTags(body.tagline     || "").slice(0, 200);
    base.deliverables = stripTags(body.deliverables || "").slice(0, 300);
    base.includes     = Array.isArray(body.includes)
      ? body.includes.map((s) => stripTags(String(s)).slice(0, 100))
      : [];
    base.featured = !!body.featured;
  }

  return base;
}
