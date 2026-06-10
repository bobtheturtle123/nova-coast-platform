// CubiCasa integration service (MVP — "Import from CubiCasa").
//
// Each tenant connects their OWN CubiCasa company account with an account email
// + API key. No partner integration, no OAuth, no master account. All CubiCasa
// API calls are server-side; the API key is encrypted at rest and never returned
// to the client.
//
// Token storage: tenants/{tenantId}/integrations/cubicasa
//   { provider, email, apiKeyEnc, authMethod, authEndpoint, lastVerifiedAt,
//     createdAt, updatedAt }
//
// CubiCasa's Integrate API (v3) is primarily an ordering + webhook-delivery API.
// Listing already-completed floor plans may or may not be available depending on
// the account. We attempt it honestly and, if it's not supported, we say so
// rather than faking results. The structure leaves room to later receive
// completed orders via webhook (app/api/webhooks/cubicasa).

import { adminDb } from "@/lib/firebase-admin";
import { encrypt, decrypt } from "@/lib/encryption";

const BASE = "https://app.cubi.casa/api/integrate/v3";
const ENDPOINTS = ["scans", "orders"];

function integrationRef(tenantId) {
  return adminDb.collection("tenants").doc(tenantId).collection("integrations").doc("cubicasa");
}

// The auth schemes CubiCasa accounts may use. We probe and remember the one that
// works so later calls don't re-probe.
function authVariants(email, apiKey) {
  const basic = Buffer.from(`${email}:${apiKey}`).toString("base64");
  return [
    { method: "bearer",  headers: { Authorization: `Bearer ${apiKey}` } },
    { method: "basic",   headers: { Authorization: `Basic ${basic}` } },
    { method: "xapikey", headers: { "X-Api-Key": apiKey } },
  ];
}

function headersFor(method, email, apiKey) {
  return authVariants(email, apiKey).find((v) => v.method === method)?.headers
    || { Authorization: `Bearer ${apiKey}` };
}

// Validate credentials. Returns { ok, method, endpoint } or { ok:false, error }.
export async function testCredentials(email, apiKey) {
  const key = (apiKey || "").trim();
  const mail = (email || "").trim();
  if (!key || !mail) return { ok: false, error: "Email and API key are required." };

  let sawAuthError = false;
  for (const endpoint of ENDPOINTS) {
    for (const v of authVariants(mail, key)) {
      try {
        const res = await fetch(`${BASE}/${endpoint}`, {
          headers: { ...v.headers, Accept: "application/json" },
        });
        const text = await res.text();
        const isHtml = text.trimStart().startsWith("<");
        if (res.status === 401 || res.status === 403) { sawAuthError = true; continue; }
        if (isHtml) continue; // login/redirect page = not authenticated
        if (res.ok) return { ok: true, method: v.method, endpoint };
      } catch { /* try next */ }
    }
  }
  return {
    ok: false,
    error: sawAuthError
      ? "CubiCasa rejected these credentials. Double-check the account email and API key."
      : "Couldn't reach the CubiCasa API with these credentials. Confirm your CubiCasa account has API access enabled.",
  };
}

export async function saveCredentials(tenantId, email, apiKey, probe = null) {
  await integrationRef(tenantId).set({
    provider:      "cubicasa",
    email:         email.trim(),
    apiKeyEnc:     encrypt(apiKey.trim()),
    authMethod:    probe?.method || null,
    authEndpoint:  probe?.endpoint || null,
    lastVerifiedAt: probe?.ok ? new Date().toISOString() : null,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  }, { merge: true });
}

export async function getStatus(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) return { connected: false };
  const d = snap.data();
  return { connected: true, email: d.email || null, lastVerifiedAt: d.lastVerifiedAt || null };
}

export async function disconnect(tenantId) {
  await integrationRef(tenantId).delete();
}

// Server-only: decrypted creds + remembered auth scheme.
async function getCreds(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (!d.apiKeyEnc) return null;
  return { email: d.email, apiKey: decrypt(d.apiKeyEnc), method: d.authMethod, endpoint: d.authEndpoint };
}

// Re-test stored credentials and refresh lastVerifiedAt.
export async function verifyStored(tenantId) {
  const creds = await getCreds(tenantId);
  if (!creds) return { ok: false, error: "Not connected." };
  const probe = await testCredentials(creds.email, creds.apiKey);
  if (probe.ok) {
    await integrationRef(tenantId).set({
      authMethod: probe.method, authEndpoint: probe.endpoint,
      lastVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  return probe;
}

function normalizeItems(data) {
  const raw = Array.isArray(data) ? data : (data.scans ?? data.orders ?? data.data ?? data.results ?? []);
  return raw.map((o, i) => {
    const files = [];
    const fp  = o.floor_plan_url ?? o.floorPlanUrl ?? o.image_url
      ?? o.files?.find((f) => f.type === "floor_plan")?.url
      ?? o.deliverables?.find((f) => f.type === "floor_plan")?.url ?? null;
    const fpd = o.floor_plan_with_dimensions_url ?? o.floorPlanWithDimensionsUrl
      ?? o.files?.find((f) => f.type?.includes("dimension"))?.url
      ?? o.deliverables?.find((f) => f.type?.includes("dimension"))?.url ?? null;
    if (fp)  files.push({ label: "Floor plan",            url: fp,  type: "floor_plan" });
    if (fpd) files.push({ label: "Floor plan (dimensions)", url: fpd, type: "floor_plan_dimensions" });
    // Generic deliverables/files arrays, if present.
    for (const arr of [o.files, o.deliverables]) {
      for (const f of (arr || [])) {
        if (f?.url && !files.some((x) => x.url === f.url)) {
          files.push({ label: f.name || f.type || "File", url: f.url, type: f.type || "file" });
        }
      }
    }
    return {
      id:        o.id ?? o.order_id ?? `cc-${i}`,
      address:   o.address ?? o.property_address ?? o.location ?? "",
      createdAt: o.created_at ?? o.createdAt ?? null,
      status:    o.status ?? null,
      files,
    };
  }).filter((x) => x.files.length > 0); // only completed items with downloadable files
}

// List completed floor plans for the connected tenant.
// Returns { supported:true, items:[...] } or { supported:false, message }.
export async function listFloorplans(tenantId) {
  const creds = await getCreds(tenantId);
  if (!creds) return { supported: false, message: "CubiCasa is not connected.", notConnected: true };

  // Prefer the remembered scheme/endpoint, then fall back to probing.
  const order = [];
  if (creds.method && creds.endpoint) order.push({ method: creds.method, endpoint: creds.endpoint });
  for (const endpoint of ENDPOINTS) for (const v of authVariants(creds.email, creds.apiKey)) {
    order.push({ method: v.method, endpoint });
  }

  for (const { method, endpoint } of order) {
    try {
      const res = await fetch(`${BASE}/${endpoint}`, {
        headers: { ...headersFor(method, creds.email, creds.apiKey), Accept: "application/json" },
      });
      const text = await res.text();
      if (text.trimStart().startsWith("<")) continue;
      if (res.status === 401 || res.status === 403) continue;
      if (!res.ok) continue;
      let data; try { data = JSON.parse(text); } catch { continue; }
      const items = normalizeItems(data);
      return { supported: true, items };
    } catch { /* try next */ }
  }

  // Reached the API but it doesn't expose a listable set of completed plans.
  return {
    supported: false,
    message: "Your CubiCasa account doesn't expose a list of completed floor plans through the API. " +
             "Completed plans can be received automatically once order webhooks are enabled.",
  };
}

// Download a CubiCasa file URL server-side. Tries unauthenticated first (many
// deliverable URLs are pre-signed), then with the account's auth scheme.
export async function downloadFile(tenantId, fileUrl) {
  const creds = await getCreds(tenantId);
  if (!creds) throw new Error("CubiCasa is not connected.");
  let res = await fetch(fileUrl);
  if (!res.ok || (res.headers.get("content-type") || "").includes("text/html")) {
    res = await fetch(fileUrl, { headers: headersFor(creds.method, creds.email, creds.apiKey) });
  }
  if (!res.ok) throw new Error(`CubiCasa file download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
