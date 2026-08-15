import { adminDb } from "@/lib/firebase-admin";
import { fileSetHash } from "@/lib/galleryZip";

export const dynamic = "force-dynamic";

function s3client() {
  // eslint-disable-next-line global-require
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function deleteKey(key) {
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
  } catch { /* best-effort */ }
}

// Called ONLY by the Cloudflare ZIP-builder Worker once it has finished uploading
// a package ZIP to R2 (shared-secret guarded). Flips the gallery's zipPackage
// pointer to the freshly-built ZIP — but only if the file set hasn't changed since
// the build started. If it has, the built ZIP is already stale: discard it and let
// the reconciliation cron (or the next download) enqueue a fresh build. The
// previous ready package is left untouched throughout, so clients never lose a
// valid download and never receive a partial one.
export async function POST(req) {
  if (req.headers.get("x-zip-secret") !== process.env.ZIP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tenantId, galleryId, hash, key, bytes } = await req.json().catch(() => ({}));
  if (!tenantId || !galleryId || !hash || !key) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const ref  = adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId);
  const snap = await ref.get();
  if (!snap.exists) {
    await deleteKey(key); // orphan — nothing points to it
    return Response.json({ error: "Gallery not found" }, { status: 404 });
  }
  const gallery = snap.data();

  const tSnap = await adminDb.collection("tenants").doc(tenantId).get();
  const autoRename = tSnap.data()?.gallerySettings?.autoRenameDownloads === true;
  const currentHash = fileSetHash(gallery, "package", autoRename);

  // Files changed while building → the built ZIP is stale. Bin it and clear the
  // pending marker so a fresh build gets enqueued. Keep the previous package.
  if (hash !== currentHash) {
    await deleteKey(key);
    await ref.update({ zipPending: null });
    return Response.json({ ok: true, stale: true });
  }

  const prevKey = gallery.zipPackage?.key || null;
  await ref.update({
    zipPackage: {
      key,
      hash,
      status: "ready",
      sizeBytes: Number(bytes) || 0,
      builtAt: new Date().toISOString(),
    },
    zipPending: null,
  });

  // Now that the new package is live, remove the superseded one.
  if (prevKey && prevKey !== key && prevKey.startsWith("gallery-zips/")) {
    await deleteKey(prevKey);
  }

  return Response.json({ ok: true });
}
