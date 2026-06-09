import { adminDb } from "@/lib/firebase-admin";
import { addStorage } from "@/lib/storage";
import { transcodeTo1080p, webVideoKey, MAX_INLINE_TRANSCODE_BYTES } from "@/lib/videoTranscode";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Generate 1080p web-viewable versions for delivered videos that don't have one.
//
// The 1080p version is kept long-term for gallery playback (it stays available
// even after the full-res original is removed for storage management). We process
// a few videos per run to stay within the function's time budget; the cron runs
// regularly and works through the backlog.
//
// Videos larger than MAX_INLINE_TRANSCODE_BYTES are marked "skipped_large" and
// left untouched — their full-res original is also never auto-removed, so the
// gallery keeps a playable file. Those should be handled by a dedicated worker.

const PER_RUN = 3;

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response("Server misconfiguration", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  const r2Url  = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!r2Url || !bucket) return Response.json({ error: "Storage not configured" }, { status: 500 });

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const report = { scanned: 0, generated: 0, skippedLarge: 0, failed: 0, processed: [] };

  const tenantsSnap = await adminDb.collection("tenants").get();
  outer:
  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const galSnap = await adminDb
      .collection("tenants").doc(tenantId).collection("galleries").get();

    for (const galDoc of galSnap.docs) {
      const gallery = galDoc.data();
      const media = [...(gallery.media || [])];
      let changed = false;

      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        if (!m.key || !m.fileType?.startsWith("video/")) continue;
        // Skip if it already has a web version, is in progress, failed, or skipped.
        if (m.webVideoKey || ["ready", "processing", "failed", "skipped_large"].includes(m.webVideoStatus)) continue;
        report.scanned++;

        const size = Number(m.size) || 0;
        if (size > MAX_INLINE_TRANSCODE_BYTES) {
          media[i] = { ...m, webVideoStatus: "skipped_large" };
          changed = true;
          report.skippedLarge++;
          continue;
        }

        try {
          const res = await fetch(`${r2Url}/${m.key}`);
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          const inputBuf = Buffer.from(await res.arrayBuffer());

          const { buffer, bytes } = await transcodeTo1080p(inputBuf);
          const wKey = webVideoKey(m.key);
          await s3.send(new PutObjectCommand({
            Bucket: bucket, Key: wKey, Body: buffer, ContentType: "video/mp4",
          }));

          media[i] = {
            ...m,
            webVideoKey:    wKey,
            webVideoUrl:    `${r2Url}/${wKey}`,
            webVideoBytes:  bytes,
            webVideoStatus: "ready",
            webVideoAt:     new Date().toISOString(),
          };
          changed = true;
          await addStorage(tenantId, bytes, "video");
          report.generated++;
          report.processed.push({ tenantId, galleryId: galDoc.id, key: m.key, webBytes: bytes });
        } catch (e) {
          media[i] = { ...m, webVideoStatus: "failed", webVideoError: e?.message || "transcode failed" };
          changed = true;
          report.failed++;
          console.error(`[transcode-web-videos] ${tenantId}/${galDoc.id} ${m.key}: ${e?.message}`);
        }

        if (changed) await galDoc.ref.update({ media });
        if (report.generated >= PER_RUN) break outer;
      }

      if (changed) await galDoc.ref.update({ media });
    }
  }

  return Response.json(report);
}
