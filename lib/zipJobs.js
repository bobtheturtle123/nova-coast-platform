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
import { webPhotoProgress } from "@/lib/webPhoto";

// R2 key for a gallery's package ZIP. Hash-named so a changed file set produces a
// new object and the old one can be deleted only after the pointer is flipped.
export function zipDestKey(tenantId, galleryId, hash) {
  return `gallery-zips/${tenantId}/${galleryId}/${hash}.zip`;
}

// One clear answer to "is this listing ready to deliver?" — i.e. every Web
// Ready/MLS photo is generated AND the complete "Download Everything" ZIP is built
// for the CURRENT file set. Used by the tenant dashboard (a single status badge)
// and the client download button (poll text). Purely derived from the gallery doc,
// so it's always in sync with the pipeline state.
//
// phase:
//   "processing-web" – Web Ready versions still generating (web.pending > 0)
//   "building"       – web done, package ZIP not yet built for the current files
//   "ready"          – web done AND ZIP built for the current file set → deliver
export function galleryDeliveryStatus(gallery = {}, autoRename = false) {
  const web  = webPhotoProgress(gallery);
  const hash = fileSetHash(gallery, "package", autoRename);
  const pkg  = gallery.zipPackage || null;
  const zipReady = !!(pkg && pkg.status === "ready" && pkg.hash === hash);

  // Tenant-facing label is deliberately plain: the photographer never needs to
  // know about Web Ready processing, queues, or ZIP builds. Everything that isn't
  // "done" reads as one calm "Preparing delivery…"; the technical phase is still
  // returned separately for internal callers (agent poll, cron).
  let phase, label;
  if (!web.done) {
    phase = "processing-web";
    label = "Preparing delivery…";
  } else if (zipReady) {
    phase = "ready";
    label = "Ready to deliver";
  } else {
    phase = "building";
    label = "Preparing delivery…";
  }

  return {
    phase,
    ready: phase === "ready",
    label,
    web,                                   // { total, ready, pending, failed, done }
    zip: pkg
      ? { status: pkg.status || null, sizeBytes: pkg.sizeBytes || 0, builtAt: pkg.builtAt || null, current: zipReady }
      : { status: null, sizeBytes: 0, builtAt: null, current: false },
  };
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
  const ref  = adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId);

  if (pkg && pkg.status === "ready" && pkg.hash === hash) return { enqueued: false, reason: "up-to-date" };

  // Only a build actually handed to the Worker (status "queued") counts as
  // in-flight. A "waiting-web" marker must NOT short-circuit — we re-evaluate web
  // readiness on every call so the build fires the moment the last Web Ready
  // version lands.
  if (
    pend && pend.status === "queued" && pend.hash === hash && pend.enqueuedAt &&
    Date.now() - new Date(pend.enqueuedAt).getTime() < STALE_MS
  ) {
    return { enqueued: false, reason: "in-flight" };
  }

  // GATE: never build the package until every required Web Ready/MLS version has
  // been generated (or permanently exhausted its retries). Building early would
  // ship a ZIP that's silently missing MLS photos and mark it "Ready". Stamp a
  // waiting-web marker so the tenant/client can see it's still preparing.
  const prog = webPhotoProgress(gallery);
  if (!prog.done) {
    await ref.update({
      zipPending: {
        hash,
        status: "waiting-web",
        webPending: prog.pending,
        webReady: prog.ready,
        webTotal: prog.total,
        enqueuedAt: new Date().toISOString(),
      },
    });
    return { enqueued: false, reason: "waiting-web", webPending: prog.pending };
  }

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

// The single "I'm done editing this delivery — get it ready" action. Called when
// the tenant takes a deliberate step (delivering the gallery, unlocking it for
// download). It does the two things needed to have the package waiting for the
// agent, in order and idempotently:
//   1. start any missing Web Ready/MLS generation (debounced; no-op if complete),
//   2. enqueue the background ZIP build for the CURRENT file set.
// enqueueZipBuild is itself gated on web-readiness (it stamps a waiting-web marker
// and the generator enqueues the real build the instant the last version lands) and
// deduped by hash, so this never builds prematurely, never double-builds the same
// file set, and is safe to call repeatedly. Reads the gallery + autoRename fresh so
// callers don't have to. Best-effort: the download poll and fallback cron still
// reconcile if anything here is dropped.
export async function prepareGalleryPackage(tenantId, galleryId) {
  try {
    if (!tenantId || !galleryId) return;
    const [gSnap, tSnap] = await Promise.all([
      adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get(),
      adminDb.collection("tenants").doc(tenantId).get(),
    ]);
    if (!gSnap.exists) return;
    const gallery = gSnap.data();
    const autoRename = tSnap.data()?.gallerySettings?.autoRenameDownloads === true;
    const { maybeKickWebPhotoGeneration } = await import("@/lib/webPhotoKick");
    await maybeKickWebPhotoGeneration(tenantId, galleryId, gallery);
    await enqueueZipBuild(tenantId, galleryId, gallery, autoRename);
  } catch {
    /* non-fatal — download poll + fallback cron still prepare the package */
  }
}
