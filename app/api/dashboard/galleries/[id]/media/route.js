import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { enqueueZipBuild } from "@/lib/zipJobs";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// A media add/remove changes the file set, which changes fileSetHash. For a
// gallery that's ALREADY delivered/unlocked, the built package silently goes
// stale and the badge sits on "Preparing delivery…" until the once-a-day
// reconcile cron reaches it — this is exactly what strands a video/photo
// uploaded to an already-delivered listing (the PATCH edit route re-queues, but
// uploads and deletes come through here). Re-queue a build so it self-heals now.
// Skipped while a gallery is still pre-delivery (delivered & unlocked both false)
// so a fresh upload doesn't build once per file. enqueueZipBuild is hash-deduped
// and web-gated (it only stamps a waiting-web marker until the last Web Ready
// photo lands, then the generator fires ONE build), so this never double-builds
// or builds prematurely mid-upload.
async function maybeRebuildPackage(tenantId, galleryId, gallery) {
  try {
    if (!(gallery.delivered === true || gallery.unlocked === true)) return;
    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;
    await enqueueZipBuild(tenantId, galleryId, gallery, autoRename);
  } catch { /* fallback cron still reconciles */ }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { publicUrl, fileName, fileType, key, size } = await req.json();
  const bytes = Number(size) || 0;

  // Defense in depth: the R2 key must live under THIS tenant's namespace
  // (galleries/{tenantId}/...). Prevents attaching another tenant's object to
  // your gallery — our upload-url route always issues keys in this shape.
  if (key && !String(key).startsWith(`galleries/${ctx.tenantId}/`)) {
    return Response.json({ error: "Invalid media key" }, { status: 400 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  await galleryRef.update({
    media: FieldValue.arrayUnion({ url: publicUrl, key: key || "", fileName, fileType, size: bytes, uploadedAt: new Date().toISOString() }),
  });

  // Track account storage usage by file type.
  if (bytes > 0) {
    try {
      const { addStorage, categoryForType } = await import("@/lib/storage");
      await addStorage(ctx.tenantId, bytes, categoryForType(fileType));
    } catch (e) { console.error("[media] storage track failed:", e?.message); }
  }

  // Start generating the Web Ready/MLS version of this photo in the background as
  // it uploads — don't wait for delivery. Self-debounced via a Firestore lease, so
  // a 1,000-photo upload spawns ONE generation chain (which picks up new photos as
  // they land) rather than a thousand overlapping runs. Photos only — videos have
  // no Web Ready photo step, and maybeKick would be a no-op there anyway.
  if (String(fileType || "").startsWith("image/")) {
    try {
      const { maybeKickWebPhotoGeneration } = await import("@/lib/webPhotoKick");
      await maybeKickWebPhotoGeneration(ctx.tenantId, params.id, null);
    } catch { /* fallback cron still reconciles */ }
  }

  // Read fresh so the rebuild hash reflects the file we just added, then re-queue
  // the package build if this gallery is already delivered/unlocked.
  const fresh = await galleryRef.get();
  if (fresh.exists) await maybeRebuildPackage(ctx.tenantId, params.id, fresh.data());

  return Response.json({ ok: true });
}

// DELETE: remove one or more media items by key
export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { keys } = await req.json(); // keys: string[]
  if (!Array.isArray(keys) || keys.length === 0) {
    return Response.json({ error: "keys array required" }, { status: 400 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const snap = await galleryRef.get();
  if (!snap.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const gallery = snap.data();
  const keySet  = new Set(keys);
  const removed = (gallery.media || []).filter((m) => keySet.has(m.key));
  const updated = (gallery.media || []).filter((m) => !keySet.has(m.key));

  await galleryRef.update({ media: updated });

  // Decrement account storage for the removed files.
  try {
    const { removeStorage, categoryForType } = await import("@/lib/storage");
    for (const m of removed) {
      if (m.size > 0) await removeStorage(ctx.tenantId, Number(m.size) || 0, categoryForType(m.fileType));
    }
  } catch (e) { console.error("[media] storage untrack failed:", e?.message); }

  // Best-effort R2 deletion (no auth needed for admin delete, uses service account)
  try {
    const { S3Client, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region:   "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    const objects = keys.map((k) => ({ Key: k }));
    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: { Objects: objects },
    }));
  } catch {
    // Non-fatal — media removed from gallery even if R2 cleanup fails
  }

  // Removing files changes the set too — re-queue the package for an already
  // delivered/unlocked gallery so the download no longer contains the deleted media.
  await maybeRebuildPackage(ctx.tenantId, params.id, { ...gallery, media: updated });

  return Response.json({ ok: true, remaining: updated.length });
}
