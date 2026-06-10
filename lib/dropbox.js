// Dropbox integration service. All Dropbox API calls happen server-side; tokens
// are stored encrypted per tenant and never sent to the client.
//
// Token storage: tenants/{tenantId}/integrations/dropbox
//   { provider, accessTokenEnc, refreshTokenEnc, expiresAt, accountId,
//     email, createdAt, updatedAt }

import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { encrypt, decrypt } from "@/lib/encryption";

// Minimum scopes: browse metadata, download content, read account email.
export const DROPBOX_SCOPES = ["files.metadata.read", "files.content.read", "account_info.read"];

const AUTH_URL  = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API       = "https://api.dropboxapi.com/2";
const CONTENT   = "https://content.dropboxapi.com/2";

function cfg() {
  return {
    clientId:     process.env.DROPBOX_CLIENT_ID,
    clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    redirectUri:  process.env.DROPBOX_REDIRECT_URI,
  };
}
export function isConfigured() {
  const c = cfg();
  return !!(c.clientId && c.clientSecret && c.redirectUri);
}

function integrationRef(tenantId) {
  return adminDb.collection("tenants").doc(tenantId).collection("integrations").doc("dropbox");
}

// ── OAuth state (CSRF) — signed so the callback can trust tenant identity ────
function stateSecret() {
  return process.env.INTEGRATIONS_ENC_KEY || process.env.CRON_SECRET || "kyoria-dev";
}
export function signState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState(state, maxAgeMs = 10 * 60 * 1000) {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (Date.now() - data.t > maxAgeMs) return null;
  return data;
}

export function buildAuthUrl(state) {
  const c = cfg();
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    token_access_type: "offline", // get a refresh token
    scope: DROPBOX_SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function tokenRequest(params) {
  const c = cfg();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: c.clientId, client_secret: c.clientSecret }),
  });
  if (!res.ok) throw new Error(`Dropbox token error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Exchange an auth code, fetch the account email, and persist encrypted tokens.
export async function exchangeCodeAndStore(tenantId, code) {
  const c = cfg();
  const tok = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: c.redirectUri,
  });

  let email = null;
  try {
    const acct = await fetch(`${API}/users/get_current_account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (acct.ok) email = (await acct.json())?.email || null;
  } catch { /* non-fatal */ }

  await integrationRef(tenantId).set({
    provider:        "dropbox",
    accessTokenEnc:  encrypt(tok.access_token),
    refreshTokenEnc: tok.refresh_token ? encrypt(tok.refresh_token) : null,
    expiresAt:       new Date(Date.now() + (tok.expires_in || 14400) * 1000).toISOString(),
    accountId:       tok.account_id || null,
    email,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  }, { merge: true });

  return { email };
}

export async function getStatus(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) return { connected: false };
  const d = snap.data();
  return { connected: true, email: d.email || null, accountId: d.accountId || null };
}

export async function disconnect(tenantId) {
  await integrationRef(tenantId).delete();
}

// Return a valid access token for the tenant, refreshing if expired.
// Throws { reconnect: true } if there's no usable token.
export async function getValidAccessToken(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) { const e = new Error("Dropbox not connected"); e.reconnect = true; throw e; }
  const d = snap.data();

  const notExpired = d.expiresAt && new Date(d.expiresAt).getTime() - 60_000 > Date.now();
  if (notExpired && d.accessTokenEnc) return decrypt(d.accessTokenEnc);

  // Refresh.
  if (!d.refreshTokenEnc) { const e = new Error("Dropbox session expired"); e.reconnect = true; throw e; }
  try {
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(d.refreshTokenEnc) });
    await integrationRef(tenantId).set({
      accessTokenEnc: encrypt(tok.access_token),
      expiresAt:      new Date(Date.now() + (tok.expires_in || 14400) * 1000).toISOString(),
      updatedAt:      new Date().toISOString(),
    }, { merge: true });
    return tok.access_token;
  } catch (err) {
    const e = new Error("Dropbox session expired. Please reconnect.");
    e.reconnect = true;
    throw e;
  }
}

// List a folder. path "" is the Dropbox root. Returns { entries: [...] }.
export async function listFolder(tenantId, path = "") {
  const token = await getValidAccessToken(tenantId);
  const entries = [];
  let res = await fetch(`${API}/files/list_folder`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path: path || "", recursive: false, limit: 1000 }),
  });
  if (!res.ok) throw new Error(`Dropbox list error ${res.status}: ${await res.text()}`);
  let data = await res.json();
  entries.push(...data.entries);
  while (data.has_more) {
    res = await fetch(`${API}/files/list_folder/continue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cursor: data.cursor }),
    });
    if (!res.ok) break;
    data = await res.json();
    entries.push(...data.entries);
  }

  return {
    entries: entries.map((e) => ({
      type: e[".tag"], // "folder" | "file"
      name: e.name,
      path: e.path_lower,
      id:   e.id || null,
      size: e.size || 0,
    })),
  };
}

// Download a single file's bytes from Dropbox.
export async function downloadFile(tenantId, path) {
  const token = await getValidAccessToken(tenantId);
  const res = await fetch(`${CONTENT}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error(`Dropbox download error ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
