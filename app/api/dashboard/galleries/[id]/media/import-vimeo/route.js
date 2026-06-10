import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { downloadVideo } from "@/lib/vimeo";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// Import selected Vimeo videos into a listing gallery. Files are downloaded
// server-side from Vimeo and uploaded into the SAME R2 storage + gallery media
// records as a normal upload, so imported videos behave identically.

const MAX_FILES_PER_GALLERY = 1000;
// Importing very large originals through a serverless function isn't safe.
const IMPORT_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { items } = await req.json().catch(() => ({}));
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "No videos selected." }, { status: 400 });
  }
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    return Response.json({ error: "Storage not configured." }, { status: 500 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);
  const gSnap = await galleryRef.get();
  if (!gSnap.exists) return Response.json({ error: "Gallery not found." }, { status: 404 });

  let remainingSlots = MAX_FILES_PER_GALLERY - (gSnap.data().media || []).length;

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const { checkStorageLimit, addStorage } = await import("@/lib/storage");

  const imported = [];
  const skipped  = [];

  for (const item of items) {
    const name = `${(item?.name || "video").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60)}.mp4`;
    if (!item?.downloadLink) { skipped.push({ name, reason: "This video isn't downloadable (needs a Vimeo Pro/Business account with downloads enabled)" }); continue; }
    if (remainingSlots <= 0) { skipped.push({ name, reason: "Gallery is full (1000 files max)" }); continue; }
    if (Number(item.size) > IMPORT_MAX_BYTES) { skipped.push({ name, reason: "Too large to import (500 MB max)" }); continue; }

    try {
      const lim = await checkStorageLimit(ctx.tenantId, Number(item.size) || 0);
      if (lim.blocked) { skipped.push({ name, reason: "Account storage limit reached" }); continue; }
    } catch { /* allow */ }

    try {
      const buf = await downloadVideo(item.downloadLink);
      if (buf.length > IMPORT_MAX_BYTES) { skipped.push({ name, reason: "Too large to import (500 MB max)" }); continue; }

      const key = `galleries/${ctx.tenantId}/${params.id}/${Date.now()}_${name}`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: buf, ContentType: "video/mp4" }));
      const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

      await galleryRef.update({
        media: FieldValue.arrayUnion({
          url, key, fileName: name, fileType: "video/mp4", size: buf.length,
          uploadedAt: new Date().toISOString(), source: "vimeo",
        }),
      });
      try { await addStorage(ctx.tenantId, buf.length, "video"); } catch {}

      imported.push({ url, key, fileName: name, fileType: "video/mp4", size: buf.length });
      remainingSlots -= 1;
    } catch (e) {
      console.error("[import-vimeo]", name, e?.message);
      skipped.push({ name, reason: "Import failed" });
    }
  }

  return Response.json({ ok: imported.length > 0, imported, skipped, importedCount: imported.length, skippedCount: skipped.length });
}
