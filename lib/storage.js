// Per-account storage tracking + the flat 10 TB limit (same for every plan).
//
// We keep a running tally on each tenant doc under `storage`:
//   { totalBytes, photoBytes, videoBytes, documentBytes, floorPlanBytes, updatedAt,
//     warned80, warned90, blocked100 }
// incremented on upload and decremented on delete. This avoids scanning every
// gallery to compute usage. A reconcile job (admin report) can recompute exactly.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const GB = 1024 ** 3;
export const TB = 1024 ** 4;
export const STORAGE_LIMIT_BYTES = 10 * TB; // 10 TB, all plans

export const WARN_80 = 0.8 * STORAGE_LIMIT_BYTES;
export const WARN_90 = 0.9 * STORAGE_LIMIT_BYTES;

// ── Storage pricing config (single source of truth) ─────────────────────────
// Update the per-GB monthly rate here if Cloudflare R2 pricing changes; every
// cost estimate in the app derives from this constant.
//
// Customer downloads are served directly from R2 using pre-signed URLs and do
// not stream through Vercel. R2 currently has free internet egress, so storage
// is the primary infrastructure cost to monitor.
export const R2_STORAGE_USD_PER_GB_MONTH = 0.015;

// Thresholds that drive the superadmin "recommended action" for each account.
export const ACTION_THRESHOLDS = {
  watchPct:        0.80, // >= 80% of the 10 TB cap → "watch"
  contactPct:      0.90, // >= 90% → "contact account"
  requireAddonPct: 0.97, // >= ~100% → "require storage add-on"
  // Cost-relative escalations (storage cost as a fraction of plan price):
  watchCostRatio:        0.35,
  requireAddonCostRatio: 0.60,
};

// Estimated monthly R2 storage cost (USD) for a given number of bytes.
export function monthlyStorageCostUsd(bytes = 0) {
  return (Math.max(0, bytes) / GB) * R2_STORAGE_USD_PER_GB_MONTH;
}

// Warning level for a usage amount: "normal" | "80" | "90" | "100".
export function warnLevel(bytes = 0) {
  const used = Math.max(0, bytes);
  if (used >= STORAGE_LIMIT_BYTES)          return "100";
  if (used >= WARN_90)                       return "90";
  if (used >= WARN_80)                       return "80";
  return "normal";
}

// Map a MIME type to a tracked category. Floor plans are uploaded through a
// dedicated path, so callers pass category="floorPlan" explicitly for those.
export function categoryForType(fileType = "") {
  const t = fileType.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "photo";
  return "document"; // pdf, docx, etc.
}

const FIELD = {
  photo:     "photoBytes",
  video:     "videoBytes",
  document:  "documentBytes",
  floorPlan: "floorPlanBytes",
};

// Increment the tenant's storage counters. Fire-and-forget safe.
export async function addStorage(tenantId, bytes, category = "document") {
  if (!tenantId || !bytes || bytes <= 0) return;
  const field = FIELD[category] || FIELD.document;
  await adminDb.collection("tenants").doc(tenantId).set({
    storage: {
      totalBytes: FieldValue.increment(bytes),
      [field]:    FieldValue.increment(bytes),
      updatedAt:  new Date(),
    },
  }, { merge: true });
}

// Decrement on delete (never below zero is handled at read time).
export async function removeStorage(tenantId, bytes, category = "document") {
  if (!tenantId || !bytes || bytes <= 0) return;
  const field = FIELD[category] || FIELD.document;
  await adminDb.collection("tenants").doc(tenantId).set({
    storage: {
      totalBytes: FieldValue.increment(-bytes),
      [field]:    FieldValue.increment(-bytes),
      updatedAt:  new Date(),
    },
  }, { merge: true });
}

// Check whether an incoming upload is allowed and surface warning thresholds.
// Returns { allowed, blocked, used, projected, limit, pct }.
export async function checkStorageLimit(tenantId, incomingBytes = 0) {
  const snap = await adminDb.collection("tenants").doc(tenantId).get();
  const used = Math.max(0, snap.data()?.storage?.totalBytes || 0);
  const projected = used + Math.max(0, incomingBytes);
  const pct = projected / STORAGE_LIMIT_BYTES;

  // Emit internal admin warnings once per threshold (idempotent via flags).
  const flags = snap.data()?.storage || {};
  if (projected >= STORAGE_LIMIT_BYTES && !flags.blocked100) {
    await flagAndLog(tenantId, "blocked100", "🛑 STORAGE 100% — new large uploads blocked", projected);
  } else if (projected >= WARN_90 && !flags.warned90) {
    await flagAndLog(tenantId, "warned90", "⚠️ STORAGE 90% — account approaching the 10 TB limit", projected);
  } else if (projected >= WARN_80 && !flags.warned80) {
    await flagAndLog(tenantId, "warned80", "⚠️ STORAGE 80% — account approaching the 10 TB limit", projected);
  }

  return {
    allowed:  projected < STORAGE_LIMIT_BYTES,
    blocked:  projected >= STORAGE_LIMIT_BYTES,
    used,
    projected,
    limit:    STORAGE_LIMIT_BYTES,
    pct,
  };
}

async function flagAndLog(tenantId, flag, message, bytes) {
  try {
    console.warn(`[storage] tenant=${tenantId} ${message} (${(bytes / TB).toFixed(2)} TB)`);
    await adminDb.collection("storageAlerts").add({
      tenantId, level: flag, message, bytes, at: new Date(),
    });
    await adminDb.collection("tenants").doc(tenantId).set(
      { storage: { [flag]: true } }, { merge: true }
    );
  } catch { /* non-fatal */ }
}

export function fmtBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 3 ? 2 : 1)} ${u[i]}`;
}
