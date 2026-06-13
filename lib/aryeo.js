// Aryeo integration — import a studio's existing products into KyoriaOS.
// The API key is stored encrypted per tenant and never returned to the client.
//
// Key storage: tenants/{tenantId}/integrations/aryeo
// Aryeo API:   https://api.aryeo.com/v1  (Bearer token auth)

import { adminDb } from "@/lib/firebase-admin";
import { encrypt, decrypt } from "@/lib/encryption";

const ARYEO_BASE = "https://api.aryeo.com/v1";

function keyDoc(tenantId) {
  return adminDb.collection("tenants").doc(tenantId).collection("integrations").doc("aryeo");
}

export async function saveKey(tenantId, apiKey, probe = null) {
  await keyDoc(tenantId).set({
    apiKeyEnc:      encrypt(apiKey.trim()),
    connected:      true,
    lastVerifiedAt: new Date().toISOString(),
    ...(probe?.accountName ? { accountName: probe.accountName } : {}),
  }, { merge: true });
}

export async function getKey(tenantId) {
  const snap = await keyDoc(tenantId).get();
  if (!snap.exists) return null;
  const enc = snap.data().apiKeyEnc;
  return enc ? decrypt(enc) : null;
}

export async function getStatus(tenantId) {
  const snap = await keyDoc(tenantId).get();
  if (!snap.exists || !snap.data().apiKeyEnc) return { connected: false };
  const d = snap.data();
  return { connected: true, accountName: d.accountName || null, lastVerifiedAt: d.lastVerifiedAt || null };
}

export async function disconnect(tenantId) {
  await keyDoc(tenantId).delete().catch(() => {});
}

// ── API calls ────────────────────────────────────────────────────────────────
async function aryeoFetch(apiKey, path, { params } = {}) {
  const url = new URL(`${ARYEO_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  return res;
}

// Validate a key by hitting a lightweight endpoint.
export async function testKey(apiKey) {
  try {
    const res = await aryeoFetch(apiKey, "/products", { params: { per_page: 1 } });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Aryeo rejected that API key. Double-check it has API access." };
    }
    if (!res.ok) return { ok: false, error: `Aryeo returned ${res.status}. Try again shortly.` };
    const json = await res.json().catch(() => ({}));
    return { ok: true, sample: Array.isArray(json?.data) ? json.data.length : 0 };
  } catch {
    return { ok: false, error: "Couldn't reach Aryeo. Check your connection and try again." };
  }
}

// Fetch all pages of a list endpoint (Aryeo uses Laravel-style pagination).
async function fetchAll(apiKey, path, { hardCap = 1000, params = {} } = {}) {
  const out = [];
  let page = 1;
  for (let i = 0; i < 50; i++) {
    const res = await aryeoFetch(apiKey, path, { params: { per_page: 100, page, ...params } });
    if (!res.ok) {
      if (page === 1) throw new Error(`Aryeo ${path} returned ${res.status}`);
      break;
    }
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    out.push(...rows);
    const meta = json?.meta || {};
    const lastPage = meta.last_page || meta.lastPage;
    const hasNext = json?.links?.next || (lastPage && page < lastPage);
    if (!hasNext || rows.length === 0 || out.length >= hardCap) break;
    page++;
  }
  return out;
}

export async function fetchCategories(apiKey) {
  return fetchAll(apiKey, "/product-categories");
}

// List endpoints are often summaries. Fetch each product's detail to pick up
// images / variants / full pricing the list view may omit. Chunked + capped.
export async function fetchProductDetail(apiKey, id) {
  try {
    const res = await aryeoFetch(apiKey, `/products/${id}`);
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.data || json || null;
  } catch { return null; }
}
export async function enrichProducts(apiKey, products) {
  const out = products.map((p) => ({ ...p }));
  const idxById = {};
  out.forEach((p, i) => { if (p?.id != null) idxById[p.id] = i; });
  const ids = out.map((p) => p?.id).filter((x) => x != null).slice(0, 120);
  const CHUNK = 8;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const details = await Promise.all(slice.map((id) => fetchProductDetail(apiKey, id)));
    details.forEach((d, j) => {
      if (d && typeof d === "object") {
        const id = slice[j];
        out[idxById[id]] = { ...out[idxById[id]], ...d };
      }
    });
  }
  return out;
}
export async function fetchProducts(apiKey) {
  // Ask Aryeo to embed related resources so we get images + category in one call.
  // Some keys may be ignored/unsupported — fall back to a plain fetch on error.
  try {
    return await fetchAll(apiKey, "/products", { params: { include: "images,image,product_category,group,variants" } });
  } catch {
    return fetchAll(apiKey, "/products");
  }
}

// ── Mapping Aryeo → KyoriaOS ──────────────────────────────────────────────────
// Aryeo returns money as integer cents (e.g. price_amount: 54900 → $549).
const dollars = (cents) => {
  const n = Number(cents);
  return Number.isFinite(n) ? Math.round(n) / 100 : 0;
};

// Pull a price (in cents) from an Aryeo product/variant across known shapes.
function priceCents(o) {
  if (!o || typeof o !== "object") return 0;
  const direct = o.price_amount ?? o.amount ?? o.default_price_amount ?? o.unit_price_amount;
  if (direct != null) return Number(direct) || 0;
  // `price` can be a number (cents) or an object { amount }
  if (o.price != null) {
    if (typeof o.price === "object") return Number(o.price.amount ?? o.price.price_amount ?? 0) || 0;
    return Number(o.price) || 0;
  }
  if (o.default_price != null && typeof o.default_price === "object") return Number(o.default_price.amount ?? 0) || 0;
  return Number(o.default_price ?? o.unit_price ?? 0) || 0;
}

// Resolve the category object across Aryeo's shapes (embedded or id-referenced).
function categoryObj(product, byId) {
  return product.product_category || product.category || product.group
    || byId[product.product_category_id] || byId[product.category_id] || byId[product.group_id] || null;
}
function categoryName(product, byId) {
  const c = categoryObj(product, byId);
  if (!c) return null;
  return c.title || c.name || (typeof c === "string" ? c : null);
}

// Pull variants/options from a product across the shapes Aryeo has used.
function getVariants(product) {
  const v = product.variants || product.variations || product.options || product.product_variants;
  return Array.isArray(v) ? v : [];
}

// Best-effort image URL across Aryeo's many product/image shapes.
function pickUrl(o) {
  if (!o) return null;
  if (typeof o === "string") return o;
  if (typeof o === "object") {
    return o.url || o.large_url || o.original_url || o.display_url || o.src || o.image_url
      || o.large || o.medium || (o.sizes && (o.sizes.large || o.sizes.medium || o.sizes.original)) || null;
  }
  return null;
}
function productImage(p) {
  const first = (a) => (Array.isArray(a) && a.length ? a[0] : null);
  for (const a of [p.images, p.photos, p.media, p.thumbnails]) {
    const u = pickUrl(first(a));
    if (u) return /^https?:\/\//.test(u) ? u : null;
  }
  for (const o of [p.image, p.thumbnail, p.featured_image, p.cover_image, p.display_image, p.photo]) {
    const u = pickUrl(o);
    if (u && /^https?:\/\//.test(u)) return u;
  }
  for (const d of [p.image_url, p.thumbnail_url, p.photo_url]) {
    if (typeof d === "string" && /^https?:\/\//.test(d)) return d;
  }
  return null;
}

// Decide the KyoriaOS bucket. Aryeo's product.type is authoritative:
//   ADDON → add-ons; MAIN → a package if the title says so, else a service.
function guessType(p) {
  const ptype = String(p.type || p.kind || "").toUpperCase();
  if (ptype === "ADDON" || ptype === "ADD_ON" || ptype === "ADDON_PRODUCT") return "addons";
  const title = String(p.title || p.name || "").toLowerCase();
  if (/\bpackage|bundle|combo\b/.test(title)) return "packages";
  if (ptype === "ADDON") return "addons";
  return "services";
}

// Strip HTML + decode the few entities Aryeo descriptions use.
function cleanHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

// Map an Aryeo sqft variant ("Tiny Property (0–800 SqFt)") to a KyoriaOS tier
// name — by name match first, then by position, then the variant's own label.
function tierKeyForVariant(title, tierNames, index) {
  const m = String(title || "").match(/^\s*([0-9A-Za-z]+)\s*Property/i);
  const token = m ? m[1] : null;
  if (token) {
    const hit = tierNames.find((n) => String(n).toLowerCase() === token.toLowerCase());
    if (hit) return hit;
  }
  if (tierNames[index]) return tierNames[index];
  return String(token || title || `Option ${index + 1}`).slice(0, 40);
}

// Build a flat list of importable KyoriaOS service drafts from Aryeo products.
// A product with variants becomes one service per variant; otherwise one service.
export function mapProductsToServices(products, categories = [], tierNames = []) {
  const categoriesById = {};
  for (const c of categories) if (c?.id) categoriesById[c.id] = c;

  const items = [];
  for (const p of products || []) {
    const baseName = String(p.title || p.name || "Untitled product").trim().slice(0, 100);
    const category = categoryName(p, categoriesById);
    const description = cleanHtml(p.description || p.summary || "").slice(0, 500);
    const duration = Number(p.duration || p.duration_minutes || p.length) || null;
    const imageUrl = productImage(p);
    const type     = guessType(p);
    const variants = getVariants(p);

    // Are the variants square-footage tiers (e.g. "… (0–800 SqFt)") or quantity
    // options (e.g. "1 Photo")? Only sqft-style variants become tier pricing.
    const looksSqft = variants.some((v) => /sq\s*ft|sqft|property/i.test(String(v.title || "")));

    // ONE service per Aryeo product — never split into separate services.
    let price = dollars(priceCents(p));
    let priceTiers = null;
    const variantNames = [];
    if (variants.length > 1 && looksSqft) {
      priceTiers = {};
      variants.forEach((v, i) => {
        const vPrice = dollars(priceCents(v));
        if (vPrice <= 0) return; // Aryeo leaves unset tiers at 0 — skip them
        const key = tierKeyForVariant(v.title, tierNames, i);
        priceTiers[key] = vPrice;
        variantNames.push(String(v.title || `Option ${i + 1}`));
      });
      if (Object.keys(priceTiers).length === 0) priceTiers = null;
      else price = 0; // tiered — base price unused
    } else if (variants.length >= 1) {
      // Flat: lowest priced variant (quantity options / single-price add-ons).
      const ps = variants.map((v) => dollars(priceCents(v))).filter((x) => x > 0);
      price = ps.length ? Math.min(...ps) : dollars(priceCents(p));
    }

    items.push({
      aryeoProductId: String(p.id ?? ""),
      aryeoVariantId: null,
      name: baseName,
      price,
      ...(priceTiers ? { priceTiers, variantNames } : {}),
      description,
      category: category || null,
      duration,
      imageUrl: imageUrl || null,
      isTwilight: !!p.is_twilight,
      type, // ADDON → addons, package title → packages, else services (editable)
    });
  }
  return items;
}
