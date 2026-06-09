import { adminDb } from "@/lib/firebase-admin";
import { eligibleOriginals, isWebSized, deliveredAtMs } from "@/lib/retention";
import { removeStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Media retention cron — full-resolution ORIGINAL PHOTO cleanup after 1 year.
//
// SAFETY MODEL (per spec, dry-run is the default):
//   • GET with no flags  → DRY RUN. Reports which originals WOULD be removed and
//     how much storage would be freed. Deletes NOTHING.
//   • To actually delete, BOTH must be true:
//       - request includes ?execute=true
//       - env MEDIA_RETENTION_EXECUTE === "1"
//     This double-gate makes accidental deletion effectively impossible.
//
// Before any original is deleted we generate a web-sized (2048px) replacement so
// the gallery still displays. Floor plans, videos, documents, thumbnails,
// previews, web-sized images and all records are NEVER touched.

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 82;

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response("Server misconfiguration", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  const url       = new URL(req.url);
  const wantExec  = url.searchParams.get("execute") === "true";
  const execEnv   = process.env.MEDIA_RETENTION_EXECUTE === "1";
  const EXECUTE   = wantExec && execEnv;          // both gates required
  const now       = Date.now();

  const report = {
    mode: EXECUTE ? "EXECUTE" : "DRY_RUN",
    executeRequested: wantExec,
    executeEnvEnabled: execEnv,
    galleriesScanned: 0,
    galleriesPastRetention: 0,
    eligibleFiles: 0,
    eligibleBytes: 0,
    removedFiles: 0,
    removedBytes: 0,
    errors: 0,
    galleries: [],   // per-gallery detail (capped)
  };

  // Lazy-load heavy deps only when we may actually need them.
  let s3 = null, sharp = null, GetObjectCommand = null, PutObjectCommand = null, DeleteObjectCommand = null;
  if (EXECUTE) {
    const s3mod = await import("@aws-sdk/client-s3");
    ({ GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = s3mod);
    s3 = new s3mod.S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    sharp = (await import("sharp")).default;
  }

  const tenantsSnap = await adminDb.collection("tenants").get();

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const galSnap = await adminDb
      .collection("tenants").doc(tenantId).collection("galleries").get();

    for (const galDoc of galSnap.docs) {
      report.galleriesScanned++;
      const gallery = galDoc.data();
      const { items, bytes } = eligibleOriginals(gallery, now);
      if (items.length === 0) continue;

      report.galleriesPastRetention++;
      report.eligibleFiles += items.length;
      report.eligibleBytes += bytes;

      const detail = {
        tenantId,
        galleryId: galDoc.id,
        title: gallery.title || gallery.address || galDoc.id,
        deliveredAt: deliveredAtMs(gallery),
        eligibleFiles: items.length,
        eligibleBytes: bytes,
        removed: 0,
      };

      if (EXECUTE) {
        const media = [...(gallery.media || [])];
        let changed = false;
        for (const m of items) {
          try {
            // 1) Fetch the original.
            const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
            const res = await fetch(`${r2Url}/${m.key}`);
            if (!res.ok) throw new Error(`fetch ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());

            // 2) Generate + upload a web-sized replacement so the gallery still displays.
            const webBuf = await sharp(buf)
              .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
              .jpeg({ quality: WEB_QUALITY, progressive: true })
              .toBuffer();
            const webKey = m.key.replace(/(\.[^.]+)?$/, "").replace(/\/([^/]+)$/, "/web/$1") + "-web.jpg";
            await s3.send(new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: webKey,
              Body: webBuf,
              ContentType: "image/jpeg",
            }));

            // 3) Delete the original from R2.
            await s3.send(new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: m.key,
            }));

            // 4) Rewrite the media record to point at the web-sized file.
            const idx = media.findIndex((x) => x.key === m.key);
            if (idx >= 0) {
              media[idx] = {
                ...media[idx],
                key: webKey,
                url: `${r2Url}/${webKey}`,
                webSized: true,
                originalRemoved: true,
                originalRemovedAt: new Date().toISOString(),
                originalBytes: Number(m.size) || 0,
                size: webBuf.length,
              };
              changed = true;
            }

            // 5) Decrement storage by the bytes actually freed (original − web).
            const freed = (Number(m.size) || 0) - webBuf.length;
            if (freed > 0) await removeStorage(tenantId, freed, "photo");

            detail.removed++;
            report.removedFiles++;
            report.removedBytes += freed > 0 ? freed : 0;
          } catch (e) {
            report.errors++;
            console.error(`[media-retention] tenant=${tenantId} gallery=${galDoc.id} key=${m.key}: ${e.message}`);
          }
        }
        if (changed) {
          await galDoc.ref.update({ media, lastRetentionRunAt: new Date().toISOString() });
        }
      }

      if (report.galleries.length < 200) report.galleries.push(detail);
    }
  }

  // Persist the run so the admin report can show the latest dry-run / execute result.
  try {
    await adminDb.collection("retentionRuns").add({
      ...report,
      galleries: report.galleries.slice(0, 50), // keep the stored doc small
      at: new Date(),
    });
  } catch { /* non-fatal */ }

  return Response.json(report);
}
