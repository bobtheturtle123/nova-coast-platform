import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { downloadFile } from "@/lib/dropbox";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// Import selected Dropbox files into a listing gallery. Files are downloaded
// server-side from Dropbox and uploaded into the SAME R2 storage + gallery media
// records as a normal upload, so imported files behave identically. Dropbox is
// never hotlinked.

const MAX_FILES_PER_GALLERY = 1000;
// Per-import file cap. Large videos are streamed/uploaded directly elsewhere;
// importing multi-GB files through a serverless function is not safe.
const IMPORT_MAX_BYTES = 250 * 1024 * 1024; // 250 MB

const EXT_MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  tiff: "image/tiff", tif: "image/tiff", heic: "image/heic",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4",
  pdf: "application/pdf",
};

function mimeFor(name = "") {
  const ext = name.split(".").pop()?.toLowerCase();
  return EXT_MIME[ext] || null;
}

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
    return Response.json({ error: "No files selected." }, { status: 400 });
  }

  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    return Response.json({ error: "Storage not configured." }, { status: 500 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);
  const gSnap = await galleryRef.get();
  if (!gSnap.exists) return Response.json({ error: "Gallery not found." }, { status: 404 });

  const existingCount = (gSnap.data().media || []).length;
  let remainingSlots = MAX_FILES_PER_GALLERY - existingCount;

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const { checkStorageLimit, addStorage, categoryForType } = await import("@/lib/storage");

  const imported = [];
  const skipped  = [];
  let needReconnect = false;

  for (const item of items) {
    const name = item?.name || item?.path?.split("/").pop() || "file";
    const path = item?.path;
    if (!path) { skipped.push({ name, reason: "Missing path" }); continue; }
    if (remainingSlots <= 0) { skipped.push({ name, reason: "Gallery is full (1000 files max)" }); continue; }

    const fileType = mimeFor(name);
    if (!fileType) { skipped.push({ name, reason: "Unsupported file type" }); continue; }
    if (Number(item.size) > IMPORT_MAX_BYTES) {
      skipped.push({ name, reason: "Too large to import (250 MB max). Upload large videos directly." });
      continue;
    }

    // Storage-limit guard (10 TB account cap).
    try {
      const lim = await checkStorageLimit(ctx.tenantId, Number(item.size) || 0);
      if (lim.blocked) { skipped.push({ name, reason: "Account storage limit reached" }); continue; }
    } catch { /* allow on check failure */ }

    try {
      const buf = await downloadFile(ctx.tenantId, path);
      if (buf.length > IMPORT_MAX_BYTES) { skipped.push({ name, reason: "Too large to import (250 MB max)" }); continue; }

      const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key  = `galleries/${ctx.tenantId}/${params.id}/${Date.now()}_${safe}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: buf, ContentType: fileType,
      }));

      const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
      await galleryRef.update({
        media: FieldValue.arrayUnion({
          url, key, fileName: name, fileType, size: buf.length,
          uploadedAt: new Date().toISOString(), source: "dropbox",
        }),
      });
      try { await addStorage(ctx.tenantId, buf.length, categoryForType(fileType)); } catch {}

      imported.push({ name, url, key, fileType, size: buf.length });
      remainingSlots -= 1;
    } catch (e) {
      if (e.reconnect) { needReconnect = true; skipped.push({ name, reason: "Dropbox needs to be reconnected" }); break; }
      console.error("[import-dropbox]", name, e?.message);
      skipped.push({ name, reason: "Import failed" });
    }
  }

  return Response.json({
    ok: imported.length > 0,
    imported, skipped, needReconnect,
    importedCount: imported.length, skippedCount: skipped.length,
  });
}
