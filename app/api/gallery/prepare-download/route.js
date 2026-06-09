import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { fileSetHash, buildGalleryZipBuffer } from "@/lib/galleryZip";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// Prepared-download buffer for large / video-heavy galleries.
//
// LIFECYCLE (preparedZips collection):
//   pending   → created, not yet building
//   preparing → ZIP build in progress
//   ready     → uploaded to R2; served via a signed URL (NOT through Vercel)
//   failed    → build failed; client is told to retry or grab videos individually
//   expired   → past expiresAt; cleaned up by the cleanup-prepared-zips cron
//
// DEDUPE: jobs are keyed by (galleryId + fileSetHash). If a recent ready/preparing
// job exists for the same file set, we reuse it. If the gallery's files change,
// fileSetHash changes and a fresh job is created.
//
// SERVING: the finished ZIP lives in R2 and is handed to the browser via a
// pre-signed URL (1-hour). It does NOT stream back through this function, so
// there is no Vercel egress or 300s-timeout risk on the download itself.

const TTL_HOURS  = 24;
const ZIP_PREFIX = "prepared-zips";

async function resolveGallery(token) {
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return null;
  const { tenantId, galleryId } = tokenDoc.data();
  const [galleryDoc, tenantDoc] = await Promise.all([
    adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get(),
    adminDb.collection("tenants").doc(tenantId).get(),
  ]);
  if (!galleryDoc.exists) return null;
  const gallery = galleryDoc.data();
  if (gallery.accessToken !== token || !gallery.unlocked) return null;
  const slug = tenantDoc.data()?.slug || null;
  return { tenantId, galleryId, gallery, slug };
}

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

async function signedUrlFor(key, fileName) {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    s3client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    }),
    { expiresIn: 3600 }
  );
}

// ── POST: start (or reuse) a prepared-download job ──────────────────────────
export async function POST(req) {
  const { token, format = "web" } = await req.json().catch(() => ({}));
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  const rl = await rateLimit(req, `prepare-dl:${token}`, 10, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const resolved = await resolveGallery(token);
  if (!resolved) return Response.json({ error: "Gallery not found" }, { status: 404 });
  const { tenantId, galleryId, gallery, slug } = resolved;
  const bookingId = gallery.bookingId || null;

  const hash = fileSetHash(gallery, format);
  const jobs = adminDb.collection("preparedZips");

  // Dedupe: reuse a non-expired ready/preparing job for the same file set.
  const existingSnap = await jobs
    .where("galleryId", "==", galleryId)
    .where("fileSetHash", "==", hash)
    .where("status", "in", ["ready", "preparing", "pending"])
    .limit(1).get();
  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0];
    const data = doc.data();
    const expired = data.expiresAt && new Date(data.expiresAt).getTime() < Date.now();
    if (!expired) {
      let downloadUrl = null;
      if (data.status === "ready" && data.key) downloadUrl = await signedUrlFor(data.key, data.fileName);
      return Response.json({ jobId: doc.id, status: data.status, downloadUrl });
    }
  }

  // Create the job, then build inline (within the 300s budget) and upload to R2.
  const address  = (gallery.bookingAddress || "gallery").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const fileName = `${address}-media.zip`;
  const jobRef = await jobs.add({
    tenantId, galleryId, fileSetHash: hash, format,
    status: "preparing", fileName,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString(),
    sizeBytes: 0,
  });

  try {
    const buf = await buildGalleryZipBuffer(gallery, { format, slug, token, bookingId });
    const key = `${ZIP_PREFIX}/${tenantId}/${galleryId}/${jobRef.id}.zip`;

    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: "application/zip",
    }));

    await jobRef.update({ status: "ready", key, sizeBytes: buf.length, readyAt: new Date().toISOString() });
    const downloadUrl = await signedUrlFor(key, fileName);
    return Response.json({ jobId: jobRef.id, status: "ready", downloadUrl });
  } catch (e) {
    console.error("[prepare-download] build failed:", e?.message);
    await jobRef.update({ status: "failed", error: e?.message || "build failed" });
    return Response.json({ jobId: jobRef.id, status: "failed" }, { status: 500 });
  }
}

// ── GET: poll a job's status (and get a fresh signed URL when ready) ─────────
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });

  const doc = await adminDb.collection("preparedZips").doc(jobId).get();
  if (!doc.exists) return Response.json({ error: "Job not found" }, { status: 404 });
  const data = doc.data();

  const expired = data.expiresAt && new Date(data.expiresAt).getTime() < Date.now();
  if (expired) return Response.json({ jobId, status: "expired" });

  let downloadUrl = null;
  if (data.status === "ready" && data.key) downloadUrl = await signedUrlFor(data.key, data.fileName);
  return Response.json({ jobId, status: data.status, sizeBytes: data.sizeBytes || 0, downloadUrl });
}
