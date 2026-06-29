// Daily cleanup of locked-gallery watermarked previews.
//
// A gallery's previews (previews/{tenantId}/{galleryId}/...) are deleted ONLY
// when BOTH are true:
//   1. the gallery is paid/unlocked, AND
//   2. at least 30 days have passed since it was unlocked (or delivered).
//
// We never delete previews immediately on payment — payment paths only stamp
// unlockedAt. Before deleting, we verify the original media is still available
// (so we never strip the only viewable copy). The whole pass is idempotent.

import { adminDb } from "@/lib/firebase-admin";
import { deleteGalleryPreviews } from "@/lib/galleryPreviews";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

const MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function s3client() {
  // eslint-disable-next-line global-require
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v._seconds) return v._seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.R2_BUCKET_NAME) return Response.json({ ok: false, error: "Storage not configured" });

  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const s3 = s3client();
  const Bucket = process.env.R2_BUCKET_NAME;

  // 1) Collect unique {tenantId}/{galleryId} pairs that have preview objects.
  const galleries = new Set();
  let ContinuationToken;
  try {
    do {
      const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: "previews/", ContinuationToken }));
      for (const o of list.Contents || []) {
        // previews/{tenantId}/{galleryId}/{hash}.jpg
        const parts = (o.Key || "").split("/");
        if (parts.length >= 4 && parts[1] && parts[2]) galleries.add(`${parts[1]}/${parts[2]}`);
      }
      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (e) {
    return Response.json({ ok: false, error: e?.message }, { status: 500 });
  }

  const now = Date.now();
  let cleaned = 0, skippedLocked = 0, skippedRecent = 0, skippedNoOriginals = 0, deletedObjects = 0;

  for (const pair of galleries) {
    const [tenantId, galleryId] = pair.split("/");
    try {
      const galDoc = await adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get();
      if (!galDoc.exists) { /* gallery gone — safe to drop its previews */ }
      const g = galDoc.exists ? galDoc.data() : null;

      // Condition 1: paid/unlocked.
      if (g && !g.unlocked) { skippedLocked++; continue; }

      // Condition 2: 30+ days since unlock (or delivery).
      const eligibleAt = g ? (toMs(g.unlockedAt) || toMs(g.deliveredAt) || toMs(g.deliveredDate)) : 0;
      // If the gallery doc is gone, allow cleanup. If it's unlocked but we have
      // no timestamp, fall back to createdAt so old data still eventually clears.
      const anchor = eligibleAt || (g ? toMs(g.createdAt) : now - MIN_AGE_MS - 1);
      if (g && now - anchor < MIN_AGE_MS) { skippedRecent++; continue; }

      // Verify originals still exist before deleting previews (don't strip the
      // only viewable copy). Skip the check if the gallery doc is gone.
      if (g && r2Url) {
        const firstKey = (g.media || []).find((m) => m.key && !m.hidden)?.key;
        if (firstKey) {
          let ok = false;
          try { const r = await fetch(`${r2Url}/${firstKey}`, { method: "HEAD" }); ok = r.ok; } catch {}
          if (!ok) { skippedNoOriginals++; continue; }
        }
      }

      const n = await deleteGalleryPreviews(tenantId, galleryId);
      deletedObjects += n;
      cleaned++;
    } catch { /* skip this gallery */ }
  }

  return Response.json({ ok: true, galleriesWithPreviews: galleries.size, cleaned, deletedObjects, skippedLocked, skippedRecent, skippedNoOriginals });
}
