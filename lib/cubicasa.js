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

const DONE = ["delivered", "completed", "ready", "done", "complete"];

function normalizeOrders(data) {
  const raw = Array.isArray(data) ? data : (data.orders ?? data.data ?? data.results ?? []);
  return raw.map((o, i) => {
    const id = o.id ?? o.order_id ?? o.uuid ?? `cc-${i}`;
    const status = (o.status ?? o.state ?? "").toString();
    const files = [];
    // Inline deliverable URLs, if the order object includes them.
    for (const arr of [o.documents, o.deliverables, o.files]) {
      for (const f of (arr || [])) {
        const url = f?.url || f?.download_url || f?.href;
        if (url && !files.some((x) => x.url === url)) files.push({ label: f.name || f.type || "Document", url, type: f.type || "file" });
      }
    }
    const direct = o.floor_plan_url ?? o.combined_pdf_url ?? o.pdf_url;
    if (direct && !files.some((x) => x.url === direct)) files.push({ label: "Floor plan (PDF)", url: direct, type: "floor_plan" });
    // Best-effort: every order exposes a combined PDF deliverable endpoint.
    files.push({ label: "Combined floor-plan PDF", url: `${BASE}/orders/${id}/combined-pdf`, type: "combined_pdf" });
    return {
      id, status,
      address:   o.address ?? o.property_address ?? o.location ?? o.reference ?? "",
      createdAt: o.created_at ?? o.createdAt ?? o.ordered_at ?? null,
      files,
    };
  });
}

// List completed CubiCasa floor plans. { supported:true, items } or
// { supported:false, message }.
export async function listFloorplans(tenantId) {
  const creds = await getCreds(tenantId);
  if (!creds) return { supported: false, notConnected: true, message: "CubiCasa is not connected." };

  for (const path of ["/orders", "/orders?status=delivered"]) {
    try {
      const r = await ccGet(creds.apiKey, path);
      if (r.status === 401 || r.status === 403) {
        return { supported: false, message: "CubiCasa rejected the saved API key. Reconnect in Settings → Integrations." };
      }
      if (!r.ok || !r.json) continue;
      const items = normalizeOrders(r.json);
      // Prefer completed orders; if status info is absent, show all.
      const completed = items.filter((x) => !x.status || DONE.includes(x.status.toLowerCase()));
      return { supported: true, items: (completed.length ? completed : items) };
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
