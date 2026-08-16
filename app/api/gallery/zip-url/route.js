import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { enqueueZipBuild, galleryDeliveryStatus } from "@/lib/zipJobs";
import { maybeKickWebPhotoGeneration } from "@/lib/webPhotoKick";

export const dynamic = "force-dynamic";

// Client-facing endpoint behind the single "Download Everything" button.
//
//   { ready: true,  url }             → the package ZIP is built; download from R2
//   { ready: false, building: true }  → a build was (or is already being) prepared;
//                                        the client keeps polling until ready
//
// The ZIP itself is served straight from R2 via a presigned URL — the bytes never
// pass through Vercel. When the gallery's file set has changed since the current
// package was built, we still serve the previous valid ZIP immediately and kick a
// background rebuild, so the agent is never blocked and never gets a partial ZIP.

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
  // Any outstanding balance keeps downloads locked (matches the gallery UI).
  if (gallery.bookingId) {
    const bSnap = await adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(gallery.bookingId).get();
    const bk = bSnap.exists ? bSnap.data() : null;
    if (bk && (Number(bk.remainingBalance) || 0) > 0 && !bk.paidInFull && !bk.balancePaid) return null;
  }
  const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;
  return { tenantId, galleryId, gallery, autoRename };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  const rl = await rateLimit(req, `zip-url:${token}`, 120, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  const resolved = await resolveGallery(token);
  if (!resolved) return Response.json({ error: "Gallery not found or locked" }, { status: 404 });
  const { tenantId, galleryId, gallery, autoRename } = resolved;

  // Opening the download is itself a trigger to finish any missing Web Ready/MLS
  // versions — this is what makes already-delivered galleries (built before the
  // full set existed) self-heal without waiting for the fallback cron. No-op when
  // the set is already complete; debounced so repeated polls coalesce onto one run.
  await maybeKickWebPhotoGeneration(tenantId, galleryId, gallery);

  // Serve immediately ONLY when the built package matches the CURRENT file set.
  // ds.zip.current is true exactly when a ready ZIP exists whose hash equals the
  // gallery's current fileSetHash. A ready-but-stale package — gallery content
  // changed since it was built — must NEVER be handed to the agent, or they'd
  // silently receive a ZIP missing newly uploaded or changed content. In that case
  // we fall through to the prepare/poll path below and rebuild the current package.
  // The stale ZIP stays in R2 as an internal rollback until the fresh build is
  // promoted (zip-complete only deletes it after the pointer flip) — it's simply no
  // longer exposed through Download Everything.
  const ds  = galleryDeliveryStatus(gallery, autoRename);
  const pkg = gallery.zipPackage;
  if (ds.zip.current && pkg?.key) {
    const address = (gallery.bookingAddress || "listing").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const url = await signedUrlFor(pkg.key, `${address}-media.zip`);
    return Response.json({ ready: true, url, sizeBytes: pkg.sizeBytes || 0 });
  }

  // Not current (nothing built yet, or the current ZIP is for an older file set) —
  // ensure a build is queued for the CURRENT set and tell the client to keep
  // polling. The agent sees the calm "Preparing your download…" state and the
  // download starts automatically the moment the fresh package is ready.
  const r = await enqueueZipBuild(tenantId, galleryId, gallery, autoRename);
  return Response.json({
    ready: false,
    building: true,
    status: r.reason || "queued",
    phase: ds.phase,          // "processing-web" | "building"
    web: ds.web,              // { total, ready, pending, failed, done }
  });
}
