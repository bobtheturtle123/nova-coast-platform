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
async function fetchAll(apiKey, path, { hardCap = 1000 } = {}) {
  const out = [];
  let page = 1;
  for (let i = 0; i < 50; i++) {
    const res = await aryeoFetch(apiKey, path, { params: { per_page: 100, page } });
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
export async function fetchProducts(apiKey) {
  return fetchAll(apiKey, "/products");
}

// ── Mapping Aryeo → KyoriaOS ──────────────────────────────────────────────────
const dollars = (cents) => {
  const n = Number(cents);
  return Number.isFinite(n) ? Math.round(n) / 100 : 0;
};

function categoryName(product, categoriesById) {
  // Aryeo nests the category a few possible ways depending on API version.
  const c = product.product_category || product.category
    || (product.product_category_id && categoriesById[product.product_category_id]);
  if (!c) return null;
  return c.title || c.name || (typeof c === "string" ? c : null);
}

// Pull variants/options from a product across the shapes Aryeo has used.
function getVariants(product) {
  const v = product.variants || product.variations || product.options || product.product_variants;
  return Array.isArray(v) ? v : [];
}

// Best-effort image URL across Aryeo's product shapes.
function productImage(p) {
  const first = (arr) => Array.isArray(arr) && arr.length ? arr[0] : null;
  const fromObj = (o) => (o && typeof o === "object") ? (o.url || o.large_url || o.original_url || o.src || o.image_url) : (typeof o === "string" ? o : null);
  const cand = fromObj(p.image) || p.image_url || p.thumbnail_url || p.thumbnail
    || fromObj(first(p.images)) || fromObj(first(p.photos)) || fromObj(first(p.media));
  return typeof cand === "string" && /^https?:\/\//.test(cand) ? cand : null;
}

// Guess the KyoriaOS bucket from the Aryeo category/title/type wording.
function guessType(p, category) {
  const hay = `${p.title || p.name || ""} ${category || ""} ${p.type || p.kind || ""}`.toLowerCase();
  if (/\bpackage|bundle|combo\b/.test(hay)) return "packages";
  if (/add[\s-]?on|upgrade|extra\b/.test(hay)) return "addons";
  return "services";
}

// Build a flat list of importable KyoriaOS service drafts from Aryeo products.
// A product with variants becomes one service per variant; otherwise one service.
export function mapProductsToServices(products, categories = []) {
  const categoriesById = {};
  for (const c of categories) if (c?.id) categoriesById[c.id] = c;

  const items = [];
  for (const p of products || []) {
    const baseName = String(p.title || p.name || "Untitled product").trim().slice(0, 100);
    const category = categoryName(p, categoriesById);
    const description = String(p.description || p.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
    const duration = Number(p.duration || p.duration_minutes || p.length) || null;
    const imageUrl = productImage(p);
    const type     = guessType(p, category);
    const variants = getVariants(p);

    // ONE service per Aryeo product. Multiple variants/prices become priceTiers
    // on that single service (keyed by the variant name), never separate services.
    let price = dollars(p.price_amount ?? p.price ?? 0);
    let priceTiers = null;
    const variantNames = [];
    if (variants.length > 1) {
      priceTiers = {};
      variants.forEach((v, i) => {
        const vName = String(v.title || v.name || `Option ${i + 1}`).trim().slice(0, 40);
        const vPrice = dollars(v.price_amount ?? v.price ?? 0);
        if (vPrice > 0) { priceTiers[vName] = vPrice; variantNames.push(vName); }
      });
      if (Object.keys(priceTiers).length === 0) priceTiers = null;
      else price = 0; // tiered — base price unused
    } else if (variants.length === 1) {
      price = dollars(variants[0].price_amount ?? variants[0].price ?? p.price_amount ?? 0);
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
      type, // guessed packages | services | addons — user can override in review
    });
  }
  return items;
}
