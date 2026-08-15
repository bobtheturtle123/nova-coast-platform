// Orchestration for the background "Download Everything" ZIP builds.
//
// Vercel NEVER builds these ZIPs itself. It only enqueues a job on the Cloudflare
// Worker (which streams R2 -> zip -> R2 with zero egress and no timeout) and, when
// the Worker reports completion, flips the gallery's zipPackage pointer. This file
// holds the enqueue side; the completion side lives in /api/internal/zip-complete.
//
// State on the gallery doc:
//   zipPackage = { key, hash, status:"ready", sizeBytes, builtAt }   ← served to clients
//   zipPending = { hash, status:"queued", enqueuedAt }               ← a build in flight
//
// The previous zipPackage stays served until a fresh build finishes, so clients
// never receive a partial ZIP.

import { adminDb } from "@/lib/firebase-admin";
import { fileSetHash } from "@/lib/galleryZip";

// R2 key for a gallery's package ZIP. Hash-named so a changed file set produces a
// new object and the old one can be deleted only after the pointer is flipped.
export function zipDestKey(tenantId, galleryId, hash) {
  return `gallery-zips/${tenantId}/${galleryId}/${hash}.zip`;
}

// If a queued build is older than this with no completion, assume it died and
// allow a re-enqueue.
const STALE_MS = 20 * 60 * 1000;

// Enqueue a background ZIP build on the Cloudflare Worker, unless one for the
// current file set is already ready or in flight. Idempotent and safe to call on
// every "Download Everything" click. Returns { enqueued, reason?, hash? }.
export async function enqueueZipBuild(tenantId, galleryId, gallery, autoRename = false) {
  const workerUrl = process.env.ZIP_WORKER_URL;
  const secret    = process.env.ZIP_SECRET;
  if (!workerUrl || !secret) return { enqueued: false, reason: "not-configured" };

  const hash = fileSetHash(gallery, "package", autoRename);
  const pkg  = gallery.zipPackage || null;
  const pend = gallery.zipPending || null;

  if (pkg && pkg.status === "ready" && pkg.hash === hash) return { enqueued: false, reason: "up-to-date" };
  if (
    pend && pend.hash === hash && pend.enqueuedAt &&
    Date.now() - new Date(pend.enqueuedAt).getTime() < STALE_MS
  ) {
    return { enqueued: false, reason: "in-flight" };
  }

  const ref = adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId);
  await ref.update({ zipPending: { hash, status: "queued", enqueuedAt: new Date().toISOString() } });

  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-zip-secret": secret },
      body: JSON.stringify({ tenantId, galleryId }),
    });
    if (!res.ok) throw new Error(`worker responded ${res.status}`);
    return { enqueued: true, hash };
  } catch (e) {
    // Leave zipPending stamped; the reconciliation cron will retry later.
    console.error(`[zipJobs] enqueue failed for ${tenantId}/${galleryId}: ${e?.message}`);
    return { enqueued: false, reason: e?.message || "enqueue-failed" };
  }
}
