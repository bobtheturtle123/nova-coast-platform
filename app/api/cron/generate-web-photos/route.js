import { adminDb } from "@/lib/firebase-admin";
import { addStorage } from "@/lib/storage";
import {
  generateWebPhoto,
  webPhotoKey,
  photoWebPending,
  webPhotoProgress,
  MAX_WEB_ATTEMPTS,
} from "@/lib/webPhoto";
import { enqueueZipBuild } from "@/lib/zipJobs";
import { kickWebPhotoGeneration } from "@/lib/webPhotoKick";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Generate the 2048px web/MLS version of each delivered photo ONCE and store it
// in R2 as m.webKey. The gallery download route and the ZIP builder then reuse
// this pre-made file instead of running Sharp on every request — which is what
// keeps Fluid Active CPU flat and lets photo downloads redirect straight to R2.
//
// THROUGHPUT: we work against a wall-clock DEADLINE (not a tiny fixed count), so a
// single run resizes as many photos as fit in the function's budget and can clear
// an entire large listing in one pass instead of trickling 40/day. The old global
// cap starved big galleries behind every other one; that's why 11533 Big Canyon
// had only 22 of 198 Web Ready versions.
//
// RETRY: a photo that throws is stamped webStatus:"failed" with an incremented
// webAttempts and is retried on later runs until MAX_WEB_ATTEMPTS, then left alone
// so one bad file never blocks a gallery forever. Idempotent — a photo that
// already has m.webKey (or is a video / already web-sized / retention-stripped) is
// skipped (photoWebPending() is the single source of truth for both).
//
// CLOSING THE LOOP: when a gallery's LAST pending Web Ready version finishes, we
// immediately enqueue its "Download Everything" ZIP build so the complete package
// is ready to deliver without waiting for the next reconciliation cron.
//
// SCOPING: pass ?tenantId=&galleryId= to process just one gallery (used to prepare
// a single listing promptly); omit both to sweep everything.

// Leave headroom under maxDuration so in-flight work and the final Firestore
// writes complete before the platform kills the function.
const DEADLINE_MS = 270 * 1000;
// Hard safety cap on resizes per run regardless of the clock.
const MAX_PER_RUN = 800;

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response("Server misconfiguration", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  const r2Url  = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!r2Url || !bucket) return Response.json({ error: "Storage not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const onlyTenant  = searchParams.get("tenantId");
  const onlyGallery = searchParams.get("galleryId");

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const started = Date.now();
  const timeLeft = () => Date.now() - started < DEADLINE_MS;
  const report = { scanned: 0, generated: 0, failed: 0, galleriesCompleted: 0, zipsEnqueued: 0, timedOut: false };

  // Resolve the tenant set (scoped or all).
  const tenantDocs = onlyTenant
    ? [await adminDb.collection("tenants").doc(onlyTenant).get()].filter((d) => d.exists)
    : (await adminDb.collection("tenants").get()).docs;

  outer:
  for (const tenantDoc of tenantDocs) {
    const tenantId   = tenantDoc.id;
    const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;

    const galDocs = onlyGallery
      ? [await adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(onlyGallery).get()].filter((d) => d.exists)
      : (await adminDb.collection("tenants").doc(tenantId).collection("galleries").get()).docs;

    for (const galDoc of galDocs) {
      if (!timeLeft() || report.generated >= MAX_PER_RUN) { report.timedOut = true; break outer; }

      const gallery = galDoc.data();
      const media = [...(gallery.media || [])];
      let changed = false;

      for (let i = 0; i < media.length; i++) {
        if (!timeLeft() || report.generated >= MAX_PER_RUN) {
          report.timedOut = true;
          if (changed) await galDoc.ref.update({ media, "webGen.kickAt": new Date().toISOString() });
          break outer;
        }

        const m = media[i];
        if (!photoWebPending(m)) continue; // ready, exhausted, video, web-sized, or no original
        report.scanned++;

        try {
          const res = await fetch(`${r2Url}/${m.key}`);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const inputBuf = Buffer.from(await res.arrayBuffer());

          const { buffer, bytes } = await generateWebPhoto(inputBuf);
          const wKey = webPhotoKey(m.key);
          await s3.send(new PutObjectCommand({
            Bucket: bucket, Key: wKey, Body: buffer, ContentType: "image/jpeg",
          }));

          media[i] = {
            ...m,
            webKey:    wKey,
            webUrl:    `${r2Url}/${wKey}`,
            webBytes:  bytes,
            webStatus: "ready",
            webAt:     new Date().toISOString(),
          };
          changed = true;
          try { await addStorage(tenantId, bytes, "image"); } catch {}
          report.generated++;
        } catch (e) {
          const attempts = (Number(m.webAttempts) || 0) + 1;
          media[i] = {
            ...m,
            webStatus:   "failed",
            webAttempts: attempts,
            webError:    e?.message || "resize failed",
          };
          changed = true;
          report.failed++;
          console.error(
            `[generate-web-photos] ${tenantId}/${galDoc.id} ${m.key}: ${e?.message} (attempt ${attempts}/${MAX_WEB_ATTEMPTS})`
          );
        }
      }

      if (changed) {
        const updated = { ...gallery, media };
        const prog = webPhotoProgress(updated);

        // Manage the on-demand generation lease alongside the media write:
        //  • work remaining → refresh kickAt so entry triggers (upload, download
        //    polls, saves) stay debounced and can't start a second parallel run;
        //  • set complete → clear kickAt so the NEXT photo uploaded to this gallery
        //    re-triggers generation immediately instead of waiting out the debounce.
        await galDoc.ref.update({
          media,
          "webGen.kickAt": prog.done ? null : new Date().toISOString(),
        });

        // If this gallery now has every required Web Ready version (nothing left
        // pending), the complete package can be built. Enqueue it right away so
        // it's ready to deliver — enqueueZipBuild is idempotent and itself gated
        // on web-readiness, so this is safe to call whenever a gallery changes.
        const buildable =
          updated.unlocked === true || updated.delivered === true || updated.status === "delivered";
        if (prog.done && buildable) {
          report.galleriesCompleted++;
          try {
            const r = await enqueueZipBuild(tenantId, galDoc.id, updated, autoRename);
            if (r.enqueued) report.zipsEnqueued++;
          } catch { /* reconciliation cron will retry */ }
        }
      }
    }
  }

  // On-demand continuation: when a single-gallery run ran out of clock while it
  // was still making progress, immediately chain the next run so the listing
  // finishes NOW instead of trickling behind the every-2h fallback cron. Bounded
  // naturally — it only re-fires while real resizes are landing (generated > 0),
  // so a gallery stuck on transient fetch failures falls back to the cron rather
  // than hot-looping.
  if (onlyTenant && onlyGallery && report.timedOut && report.generated > 0) {
    try { await kickWebPhotoGeneration(onlyTenant, onlyGallery); } catch {}
  }

  return Response.json(report);
}
