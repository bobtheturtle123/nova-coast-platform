// Vimeo integration service. Each tenant connects their OWN Vimeo account via
// OAuth and imports their videos into a listing gallery. All Vimeo API calls are
// server-side; the access token is encrypted at rest and never sent to the client.
//
// Token storage: tenants/{tenantId}/integrations/vimeo
//   { provider, accessTokenEnc, scope, accountName, accountUri, createdAt, updatedAt }
//
// Vimeo access tokens are long-lived (no refresh token), so we just store the
// access token. Downloading the original video file requires the token to have
// the `video_files` scope and the account to allow downloads (Vimeo Pro+).

import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { encrypt, decrypt } from "@/lib/encryption";

const AUTH_URL  = "https://api.vimeo.com/oauth/authorize";
const TOKEN_URL = "https://api.vimeo.com/oauth/access_token";
const API       = "https://api.vimeo.com";
// Need private + video_files to read the original/download links of own videos.
export const VIMEO_SCOPES = ["public", "private", "video_files"];

function cfg() {
  return {
    clientId:     (process.env.VIMEO_CLIENT_ID || "").trim(),
    clientSecret: (process.env.VIMEO_CLIENT_SECRET || "").trim(),
    redirectUri:  (process.env.VIMEO_REDIRECT_URI || "").trim(),
  };
}
export function isConfigured() {
  const c = cfg();
  return !!(c.clientId && c.clientSecret && c.redirectUri);
}

function integrationRef(tenantId) {
  return adminDb.collection("tenants").doc(tenantId).collection("integrations").doc("vimeo");
}

// ── Signed OAuth state (CSRF) ───────────────────────────────────────────────
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
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    state,
    scope: VIMEO_SCOPES.join(" "),
  });
  return `${AUTH_URL}?${p.toString()}`;
}

// Exchange the auth code and persist the encrypted access token.
export async function exchangeCodeAndStore(tenantId, code) {
  const c = cfg();
  const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri }),
  });
  if (!res.ok) throw new Error(`Vimeo token error ${res.status}: ${await res.text()}`);
  const tok = await res.json();

  await integrationRef(tenantId).set({
    provider:       "vimeo",
    accessTokenEnc: encrypt(tok.access_token),
    scope:          tok.scope || null,
    accountName:    tok.user?.name || null,
    accountUri:     tok.user?.uri || null,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
  }, { merge: true });

  return { accountName: tok.user?.name || null };
}

export async function getStatus(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists) return { connected: false };
  const d = snap.data();
  return { connected: true, accountName: d.accountName || null };
}

export async function disconnect(tenantId) {
  await integrationRef(tenantId).delete();
}

async function getToken(tenantId) {
  const snap = await integrationRef(tenantId).get();
  if (!snap.exists || !snap.data().accessTokenEnc) { const e = new Error("Vimeo not connected"); e.reconnect = true; throw e; }
  return decrypt(snap.data().accessTokenEnc);
}

function apiHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" };
}

// List the connected account's videos with the fields we need to import.
export async function listVideos(tenantId, page = 1) {
  const token = await getToken(tenantId);
  const fields = "uri,name,duration,created_time,download,files,pictures.sizes,privacy.download";
  const res = await fetch(`${API}/me/videos?per_page=50&page=${page}&fields=${encodeURIComponent(fields)}`, {
    headers: apiHeaders(token),
  });
  if (res.status === 401) { const e = new Error("Vimeo session expired"); e.reconnect = true; throw e; }
  if (!res.ok) throw new Error(`Vimeo list error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const videos = (data.data || []).map((v) => {
    const id = (v.uri || "").split("/").pop();
    // Prefer the `download` array (originals/progressive). Fall back to `files`.
    const sources = [...(v.download || []), ...(v.files || [])].filter((f) => f.link);
    sources.sort((a, b) => (b.size || b.height || 0) - (a.size || a.height || 0));
    const best = sources[0] || null;
    const thumb = (v.pictures?.sizes || []).slice(-2, -1)[0]?.link || (v.pictures?.sizes || [])[0]?.link || null;
    return {
      id,
      name: v.name || `Vimeo ${id}`,
      duration: v.duration || 0,
      createdTime: v.created_time || null,
      thumb,
      downloadable: !!best,
      downloadLink: best?.link || null,
      size: best?.size || 0,
      ext: (best?.type || "video/mp4").includes("mp4") ? "mp4" : "mp4",
    };
  });

  return { videos, hasNext: !!data.paging?.next };
}

// Download a video file from Vimeo (the pre-resolved download link).
export async function downloadVideo(downloadLink) {
  const res = await fetch(downloadLink);
  if (!res.ok) throw new Error(`Vimeo download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
