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
    const variants = getVariants(p);

    if (variants.length > 0) {
      for (const v of variants) {
        const vName = String(v.title || v.name || "").trim();
        items.push({
          aryeoProductId: String(p.id ?? ""),
          aryeoVariantId: String(v.id ?? ""),
          name: (vName ? `${baseName} — ${vName}` : baseName).slice(0, 100),
          price: dollars(v.price_amount ?? v.price ?? p.price_amount ?? 0),
          description,
          category: category || null,
          duration: Number(v.duration || duration) || null,
          type: "services",
        });
      }
    } else {
      items.push({
        aryeoProductId: String(p.id ?? ""),
        aryeoVariantId: null,
        name: baseName,
        price: dollars(p.price_amount ?? p.price ?? 0),
        description,
        category: category || null,
        duration,
        type: "services",
      });
    }
  }
  return items;
}
