import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { stripTags } from "@/lib/rateLimit";
import { stripe } from "@/lib/stripe";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

const ALLOWED_TYPES = ["packages", "services", "addons", "retainers"];

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

// POST /api/dashboard/products?type=packages  — create or update item
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to manage products" }, { status: 403 });
  }

  const type = new URL(req.url).searchParams.get("type");
  if (!ALLOWED_TYPES.includes(type)) {
    return Response.json({ error: "Invalid type" }, { status: 400 });
  }

  const body = await req.json();
  const id   = body.id || uuidv4().replace(/-/g, "").slice(0, 16);

  const item = sanitizeItem(body, type);
  item.id = id;

  // For retainers, create Stripe Product + recurring Price
  if (type === "retainers" && process.env.STRIPE_SECRET_KEY) {
    try {
      const { interval, interval_count } = stripeInterval(item.billingInterval);
      const stripeProduct = await stripe.products.create({
        name:        item.name,
        description: item.description || undefined,
        metadata:    { tenantId: ctx.tenantId, productId: id },
      });
      const stripePrice = await stripe.prices.create({
        product:    stripeProduct.id,
        unit_amount: Math.round(item.price * 100),
        currency:   "usd",
        recurring:  { interval, interval_count },
        metadata:   { tenantId: ctx.tenantId, productId: id },
      });
      item.stripeProductId = stripeProduct.id;
      item.stripePriceId   = stripePrice.id;
    } catch (e) {
      console.error("Stripe retainer create failed:", e.message);
    }
  }

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type).doc(id)
    .set(item);

  return Response.json({ item });
}

function stripeInterval(billingInterval) {
  if (billingInterval === "year")    return { interval: "year",  interval_count: 1 };
  if (billingInterval === "quarter") return { interval: "month", interval_count: 3 };
  return { interval: "month", interval_count: 1 };
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

  if (body.priceTiers && typeof body.priceTiers === "object" && Object.keys(body.priceTiers).length > 0) {
    base.priceTiers = Object.fromEntries(
      Object.entries(body.priceTiers)
        .filter(([k]) => typeof k === "string" && k.length <= 50)
        .map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
    );
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

  // Retainer-specific
  if (type === "retainers") {
    const allowed = ["month", "quarter", "year"];
    base.billingInterval = allowed.includes(body.billingInterval) ? body.billingInterval : "month";
    base.recurring = true;
    base.priceTiers = null;
  }

  return base;
}
