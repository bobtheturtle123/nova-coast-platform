import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripTags } from "@/lib/rateLimit";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

const ALLOWED_TYPES = ["packages", "services", "addons"];

function sanitizeItem(body, type) {
  const base = {
    name:        stripTags(body.name        || "").slice(0, 100),
    description: stripTags(body.description || "").slice(0, 1000),
    price:       Number(body.price)  || 0,
    active:      body.active !== false,
    featured:    !!body.featured,
    isTwilight:  !!(type !== "addons" && body.isTwilight),
    // All media URLs — validated as https:// strings, max 20 items
    mediaUrls: Array.isArray(body.mediaUrls)
      ? body.mediaUrls.filter((u) => typeof u === "string" && u.startsWith("https://")).slice(0, 20)
      : [],
    thumbnailUrl: (
      typeof body.thumbnailUrl === "string" && body.thumbnailUrl.startsWith("https://")
        ? body.thumbnailUrl
        : (Array.isArray(body.mediaUrls) && typeof body.mediaUrls[0] === "string" && body.mediaUrls[0].startsWith("https://")
            ? body.mediaUrls[0]
            : "")
    ),
    assignedPhotographers: Array.isArray(body.assignedPhotographers)
      ? body.assignedPhotographers.map((s) => String(s).slice(0, 100)).slice(0, 50)
      : [],
    payRate: (body.payRate !== null && body.payRate !== undefined && body.payRate !== "")
      ? Math.max(0, Number(body.payRate) || 0)
      : null,
    payRateTiers: (body.payRateTiers && typeof body.payRateTiers === "object" && Object.keys(body.payRateTiers).length > 0)
      ? {
          Tiny:   Number(body.payRateTiers.Tiny)   || 0,
          Small:  Number(body.payRateTiers.Small)  || 0,
          Medium: Number(body.payRateTiers.Medium) || 0,
          Large:  Number(body.payRateTiers.Large)  || 0,
          XL:     Number(body.payRateTiers.XL)     || 0,
          XXL:    Number(body.payRateTiers.XXL)    || 0,
        }
      : null,
    // Explicitly write null for priceTiers when switching from tiered → flat pricing
    priceTiers: (body.priceTiers && typeof body.priceTiers === "object")
      ? {
          Tiny:   Number(body.priceTiers.Tiny)   || 0,
          Small:  Number(body.priceTiers.Small)  || 0,
          Medium: Number(body.priceTiers.Medium) || 0,
          Large:  Number(body.priceTiers.Large)  || 0,
          XL:     Number(body.priceTiers.XL)     || 0,
          XXL:    Number(body.priceTiers.XXL)    || 0,
        }
      : null,
  };

  // Duration: null means unset (different from 0 minutes)
  base.duration = (body.duration !== null && body.duration !== undefined && body.duration !== "")
    ? Math.max(0, Math.round(Number(body.duration) || 0))
    : null;

  // Package-specific
  if (type === "packages") {
    base.tagline      = stripTags(body.tagline     || "").slice(0, 200);
    base.deliverables = stripTags(body.deliverables || "").slice(0, 300);
    base.includes     = Array.isArray(body.includes)
      ? body.includes.map((s) => stripTags(String(s)).slice(0, 100))
      : [];
  }

  // Add-on specific
  if (type === "addons") {
    base.showWith = Array.isArray(body.showWith)
      ? body.showWith.map((s) => String(s).slice(0, 100)).slice(0, 50)
      : [];
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
