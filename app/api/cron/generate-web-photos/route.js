import { adminDb } from "@/lib/firebase-admin";
import { addStorage } from "@/lib/storage";
import { generateWebPhoto, webPhotoKey } from "@/lib/webPhoto";
import { isVideo } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Generate the 2048px web/MLS version of each delivered photo ONCE and store it
// in R2 as m.webKey. The gallery download route and the ZIP builder then reuse
// this pre-made file instead of running Sharp on every request — which is what
// keeps Fluid Active CPU flat and lets photo downloads redirect straight to R2.
//
// Mirrors transcode-web-videos: process a bounded number per run and let the cron
// work through the backlog. Idempotent — a photo that already has m.webKey (or is
// itself already web-sized / a video) is skipped.

const PER_RUN = 40;

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

  const report = { scanned: 0, generated: 0, failed: 0, processed: [] };

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
        if (!m.key) continue;
        // Photos only. Skip videos, already-generated, already-web-sized, or
        // originals removed by retention (nothing full-res left to resize).
        if (isVideo(m)) continue;
        if (m.webKey || m.webStatus === "ready" || m.webStatus === "failed") continue;
        if (m.originalRemoved || m.webSized) continue;
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
          report.processed.push({ tenantId, galleryId: galDoc.id, key: m.key, webBytes: bytes });
        } catch (e) {
          media[i] = { ...m, webStatus: "failed", webError: e?.message || "resize failed" };
          changed = true;
          report.failed++;
          console.error(`[generate-web-photos] ${tenantId}/${galDoc.id} ${m.key}: ${e?.message}`);
        }

        if (report.generated >= PER_RUN) {
          if (changed) await galDoc.ref.update({ media });
          break outer;
        }
      }

      if (changed) await galDoc.ref.update({ media });
    }
  }

  return Response.json(report);
}
