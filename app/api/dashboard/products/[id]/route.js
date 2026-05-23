import { adminDb, adminAuth } from "@/lib/firebase-admin";
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

function stripeInterval(billingInterval) {
  if (billingInterval === "year")    return { interval: "year",  interval_count: 1 };
  if (billingInterval === "quarter") return { interval: "month", interval_count: 3 };
  return { interval: "month", interval_count: 1 };
}

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
      ? Object.fromEntries(
          Object.entries(body.payRateTiers)
            .filter(([k]) => typeof k === "string" && k.length <= 50)
            .map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
        )
      : null,
    // Explicitly write null for priceTiers when switching from tiered → flat pricing
    priceTiers: (body.priceTiers && typeof body.priceTiers === "object" && Object.keys(body.priceTiers).length > 0)
      ? Object.fromEntries(
          Object.entries(body.priceTiers)
            .filter(([k]) => typeof k === "string" && k.length <= 50)
            .map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
        )
      : null,
  };

  // Duration: null means unset (different from 0 minutes)
  base.duration = (body.duration !== null && body.duration !== undefined && body.duration !== "")
    ? Math.max(0, Math.round(Number(body.duration) || 0))
    : null;

  // Per-tier duration map (services only)
  base.durationTiers = (body.durationTiers && typeof body.durationTiers === "object" && Object.keys(body.durationTiers).length > 0)
    ? Object.fromEntries(
        Object.entries(body.durationTiers)
          .filter(([k]) => typeof k === "string" && k.length <= 50)
          .map(([k, v]) => [k, Math.max(0, Math.round(Number(v) || 0))])
      )
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

  // Retainer-specific
  if (type === "retainers") {
    const allowed = ["month", "quarter", "year"];
    base.billingInterval = allowed.includes(body.billingInterval) ? body.billingInterval : "month";
    base.recurring = true;
    base.priceTiers = null;
    // Preserve existing Stripe IDs if present
    if (body.stripeProductId) base.stripeProductId = String(body.stripeProductId).slice(0, 100);
    if (body.stripePriceId)   base.stripePriceId   = String(body.stripePriceId).slice(0, 100);
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

  // For retainers: keep Stripe Product in sync and archive+recreate Price if price/interval changed
  if (type === "retainers" && process.env.STRIPE_SECRET_KEY) {
    try {
      // Read existing doc to compare
      const existing = (await adminDb
        .collection("tenants").doc(ctx.tenantId)
        .collection(type).doc(params.id).get()).data() || {};

      if (existing.stripeProductId) {
        // Update product name/description
        await stripe.products.update(existing.stripeProductId, {
          name:        item.name,
          description: item.description || "",
        });
        item.stripeProductId = existing.stripeProductId;

        const priceChanged = item.price !== existing.price || item.billingInterval !== existing.billingInterval;
        if (priceChanged && existing.stripePriceId) {
          // Archive old price
          await stripe.prices.update(existing.stripePriceId, { active: false });
        }
        if (priceChanged || !existing.stripePriceId) {
          const { interval, interval_count } = stripeInterval(item.billingInterval);
          const newPrice = await stripe.prices.create({
            product:    existing.stripeProductId,
            unit_amount: Math.round(item.price * 100),
            currency:   "usd",
            recurring:  { interval, interval_count },
            metadata:   { tenantId: ctx.tenantId, productId: params.id },
          });
          item.stripePriceId = newPrice.id;
        } else {
          item.stripePriceId = existing.stripePriceId;
        }
      }
    } catch (e) {
      console.error("Stripe retainer update failed:", e.message);
    }
  }

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

  // Archive Stripe product + price on retainer delete
  if (type === "retainers" && process.env.STRIPE_SECRET_KEY) {
    try {
      const doc = (await adminDb
        .collection("tenants").doc(ctx.tenantId)
        .collection(type).doc(params.id).get()).data() || {};
      if (doc.stripePriceId)   await stripe.prices.update(doc.stripePriceId,   { active: false });
      if (doc.stripeProductId) await stripe.products.update(doc.stripeProductId, { active: false });
    } catch (e) {
      console.error("Stripe retainer archive failed:", e.message);
    }
  }

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection(type).doc(params.id)
    .delete();

  return Response.json({ ok: true });
}
