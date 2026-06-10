// CubiCasa integration service (MVP — "Import from CubiCasa").
//
// Each tenant connects their OWN CubiCasa company account with an account email
// + API key. No partner integration, no OAuth, no master account. All CubiCasa
// API calls are server-side; the API key is encrypted at rest and never returned
// to the client.
//
// Auth (per CubiCasa Integrate API v3 docs): an `api-key: <key>` request header.
// Base: https://app.cubi.casa/api/integrate/v3
//   - GET /companies/info        → validate creds + company profile
//   - GET /orders                → list orders
//   - GET /orders/{id}/combined-pdf → the combined floor-plan PDF (best-effort)
//
// CubiCasa's API is primarily order + webhook oriented. If listing completed
// plans isn't available for an account, we say so honestly rather than faking.
//
// Token storage: tenants/{tenantId}/integrations/cubicasa
//   { provider, email, apiKeyEnc, companyName, lastVerifiedAt, createdAt, updatedAt }

import { adminDb } from "@/lib/firebase-admin";
import { encrypt, decrypt } from "@/lib/encryption";

const BASE = "https://app.cubi.casa/api/integrate/v3";

function integrationRef(tenantId) {
  return adminDb.collection("tenants").doc(tenantId).collection("integrations").doc("cubicasa");
}

function apiHeaders(apiKey) {
  return { "api-key": (apiKey || "").trim(), Accept: "application/json" };
}

async function ccGet(apiKey, path) {
  const res = await fetch(`${BASE}${path}`, { headers: apiHeaders(apiKey) });
  const text = await res.text();
  const isHtml = text.trimStart().startsWith("<");
  let json = null;
  if (!isHtml) { try { json = JSON.parse(text); } catch { /* non-json */ } }
  return { ok: res.ok, status: res.status, isHtml, json, text };
}

// Validate credentials against /companies/info. Returns { ok, profile } or
// { ok:false, error }.
export async function testCredentials(email, apiKey) {
  const key = (apiKey || "").trim();
  if (!key) return { ok: false, error: "API key is required." };
  try {
    const r = await ccGet(key, "/companies/info");
    if (r.ok && r.json) return { ok: true, profile: r.json.profile || null };
    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: "CubiCasa rejected this API key. Generate a new key in your CubiCasa company developer settings and try again." };
    }
    return { ok: false, error: `CubiCasa returned ${r.status}. Confirm your account has API access enabled.` };
  } catch (e) {
    return { ok: false, error: "Couldn't reach the CubiCasa API. Please try again." };
  }
}

export async function saveCredentials(tenantId, email, apiKey, probe = null) {
  await integrationRef(tenantId).set({
    provider:       "cubicasa",
    email:          (email || "").trim() || (probe?.profile?.email || ""),
    apiKeyEnc:      encrypt(apiKey.trim()),
    companyName:    probe?.profile?.name || null,
    lastVerifiedAt: probe?.ok ? new Date().toISOString() : null,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
  }, { merge: true });
}

export async function getStatus(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) return { connected: false };
  const d = snap.data();
  return { connected: true, email: d.email || null, companyName: d.companyName || null, lastVerifiedAt: d.lastVerifiedAt || null };
}

export async function disconnect(tenantId) {
  await integrationRef(tenantId).delete();
}

async function getCreds(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists || !snap.data().apiKeyEnc) return null;
  return { email: snap.data().email, apiKey: decrypt(snap.data().apiKeyEnc) };
}

export async function verifyStored(tenantId) {
  const creds = await getCreds(tenantId);
  if (!creds) return { ok: false, error: "Not connected." };
  const probe = await testCredentials(creds.email, creds.apiKey);
  if (probe.ok) {
    await integrationRef(tenantId).set({ lastVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  }
  return probe;
}

// Find the array of orders regardless of the response wrapper key.
function findOrdersArray(data) {
  if (Array.isArray(data)) return data;
  const KEYS = ["orders", "data", "results", "content", "items", "list", "rows"];
  for (const k of KEYS) {
    if (Array.isArray(data?.[k])) return data[k];
    if (data?.[k] && typeof data[k] === "object") {
      for (const k2 of KEYS) if (Array.isArray(data[k][k2])) return data[k][k2];
    }
  }
  for (const v of Object.values(data || {})) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  }
  return [];
}

const FLOORPLAN_TYPES = ["listing_floorplans", "floorplans", "floor_plan", "combined_pdf"];

function pretty(s) {
  return String(s).replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Flatten delivery_assets (type → {format: url} | [url] | url) into file entries.
function assetFiles(da) {
  const out = [];
  const walk = (node, prefix) => {
    if (node == null) return;
    if (typeof node === "string") {
      if (/^https?:\/\//.test(node)) {
        const top = prefix.split(".")[0];
        const fmt = prefix.split(".").slice(1).join(" ");
        out.push({ label: `${pretty(top)}${fmt ? ` (${fmt})` : ""}`, url: node, type: top });
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((v) => walk(v, prefix)); return; }
    if (typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
  };
  walk(da, "");
  // Floor plans first.
  out.sort((a, b) => {
    const ai = FLOORPLAN_TYPES.includes(a.type) ? 0 : 1;
    const bi = FLOORPLAN_TYPES.includes(b.type) ? 0 : 1;
    return ai - bi;
  });
  return out;
}

function normalizeOrders(data) {
  return findOrdersArray(data).map((o, i) => {
    const info = o.info || {};
    const addr = o.address || {};
    let createdAt = info.created_at ?? o.created_at ?? null;
    if (typeof createdAt === "number" && createdAt < 1e12) createdAt *= 1000; // unix seconds → ms
    return {
      id:        o.id ?? info.external_id ?? `cc-${i}`,
      status:    (info.status ?? o.status ?? "").toString(),
      address:   addr.full_address || [addr.street, addr.city, addr.state].filter(Boolean).join(", ") || info.location || "",
      externalId: info.external_id ?? null,
      createdAt,
      files:     assetFiles(o.delivery_assets || o.deliveryAssets),
    };
  });
}

// List completed CubiCasa floor plans. { supported:true, items } or
// { supported:false, message }.
export async function listFloorplans(tenantId) {
  const creds = await getCreds(tenantId);
  if (!creds) return { supported: false, notConnected: true, message: "CubiCasa is not connected." };

  for (const path of ["/orders", "/orders?status=delivered", "/orders?limit=100"]) {
    try {
      const r = await ccGet(creds.apiKey, path);
      if (r.status === 401 || r.status === 403) {
        return { supported: false, message: "CubiCasa rejected the saved API key. Reconnect in Settings → Integrations." };
      }
      if (!r.ok || !r.json) continue;
      const all = normalizeOrders(r.json);
      let items = all.filter((x) => x.files.length > 0);

      // The list endpoint may return summaries without delivery_assets. If so,
      // fetch order details (capped) to pull the floor-plan files.
      if (items.length === 0 && all.length > 0) {
        const detailed = await Promise.all(all.slice(0, 25).map(async (o) => {
          if (!o.id) return null;
          try {
            const d = await ccGet(creds.apiKey, `/orders/${encodeURIComponent(o.id)}`);
            if (d.ok && d.json) {
              const one = normalizeOrders(Array.isArray(d.json) ? d.json : [d.json.order ?? d.json])[0];
              if (one && one.files.length > 0) return { ...o, ...one };
            }
          } catch { /* skip */ }
          return null;
        }));
        items = detailed.filter(Boolean);
      }

      return { supported: true, items };
    } catch { /* try next */ }
  }

  return {
    supported: false,
    message: "Your CubiCasa account didn't return a list of orders through the API. " +
             "Completed plans can also be received automatically once order webhooks are enabled.",
  };
}

// Download a CubiCasa deliverable. Sends the api-key header for cubi.casa URLs;
// if the endpoint returns JSON with a url, follows it.
export async function downloadFile(tenantId, fileUrl) {
  const creds = await getCreds(tenantId);
  if (!creds) throw new Error("CubiCasa is not connected.");
  const isCubi = /(^|\.)cubi\.casa\//.test(fileUrl);

  let res = await fetch(fileUrl, { headers: isCubi ? apiHeaders(creds.apiKey) : {} });
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (res.ok && ct.includes("application/json")) {
    // Endpoint returned a pointer to the actual file.
    const j = await res.json().catch(() => null);
    const url = j?.url || j?.download_url || j?.pdf_url;
    if (url) res = await fetch(url);
  }
  if (!res.ok) throw new Error(`CubiCasa file download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
