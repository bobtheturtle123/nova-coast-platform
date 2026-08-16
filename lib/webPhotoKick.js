// On-demand Web Ready generation trigger.
//
// The scheduled generate-web-photos cron is now FALLBACK/RECOVERY only. The normal
// production flow starts Web Ready/MLS generation the instant a gallery is prepared
// for download — on unlock, on delivery, on a media save, and when the client opens
// the "Download Everything" button — instead of waiting up to two hours for the
// cron to come around.
//
// HOW IT WORKS: we can't run Sharp for a whole listing inside a 30s dashboard/API
// request, so we don't. We hand the work to the generate-web-photos function (its
// own invocation, maxDuration 300, deadline loop that self-continues while it makes
// progress). This module only DISPATCHES that scoped run and returns. A Firestore
// transaction elects a single winner per debounce window so repeated download polls
// or rapid saves all coalesce onto one in-flight generation chain rather than
// spawning overlapping runs that would clobber each other's media writes.

import { adminDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/appUrl";
import { webPhotoProgress } from "@/lib/webPhoto";

// Comfortably longer than one generate run (deadline 270s) so an active chain —
// which refreshes webGen.kickAt on every pass — keeps new triggers debounced for
// the whole time it's working, and no second parallel chain can start.
const KICK_DEBOUNCE_MS = 6 * 60 * 1000;

// Low-level: dispatch ONE scoped generate-web-photos run for a single gallery, now.
// Fire-and-forget — the generation executes in the target function's own
// invocation. We only need to hand off the request, so we open the connection and
// then let go via a short client-side timeout; the target keeps running to
// completion on its own. A dropped dispatch is harmless: the fallback cron still
// reconciles the gallery, and enqueueZipBuild stays gated on web-readiness.
export function kickWebPhotoGeneration(tenantId, galleryId) {
  if (!tenantId || !galleryId) return Promise.resolve();
  const secret = process.env.CRON_SECRET;
  if (!secret) return Promise.resolve(); // dev / misconfig — cron fallback covers it
  const url =
    `${getAppUrl()}/api/cron/generate-web-photos` +
    `?tenantId=${encodeURIComponent(tenantId)}&galleryId=${encodeURIComponent(galleryId)}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(1500),
  }).then(
    () => {},
    () => {} // aborting our side after hand-off is expected; the run continues
  );
}

// Entry-point nudge for the normal production flow. No-op when every Web Ready
// version already exists (free in-memory check) or when a run is already in flight
// for this gallery (debounced via a transaction so there is exactly one winner).
// Pass the gallery doc when you already have it to skip a read; pass null to force
// a fresh read (e.g. right after a media save changed the set).
export async function maybeKickWebPhotoGeneration(tenantId, galleryId, gallery = null) {
  try {
    if (!tenantId || !galleryId) return;
    if (!process.env.CRON_SECRET) return;
    if (gallery && webPhotoProgress(gallery).done) return; // nothing to generate

    const ref = adminDb
      .collection("tenants").doc(tenantId)
      .collection("galleries").doc(galleryId);

    const won = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const data = snap.data();
      if (webPhotoProgress(data).done) return false;      // became ready meanwhile
      const at = data.webGen?.kickAt;
      if (at && Date.now() - new Date(at).getTime() < KICK_DEBOUNCE_MS) return false;
      tx.update(ref, { "webGen.kickAt": new Date().toISOString() });
      return true;
    });

    if (won) await kickWebPhotoGeneration(tenantId, galleryId);
  } catch {
    /* non-fatal — the fallback cron still reconciles this gallery */
  }
}
