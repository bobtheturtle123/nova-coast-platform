import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { downloadFile } from "@/lib/cubicasa";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

// Import a selected CubiCasa floor plan into a listing gallery. The file is
// downloaded server-side and uploaded into the SAME R2 storage as a normal
// upload, then added to gallery.floorPlans so it appears like any other floor
// plan. CubiCasa is never hotlinked.

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB — floor plans are small (PDF/PNG)

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

function extFromUrl(url, fallback = "pdf") {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return (m?.[1] || fallback).toLowerCase();
}
const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { files } = await req.json().catch(() => ({}));
  if (!Array.isArray(files) || files.length === 0) {
    return Response.json({ error: "No floor plan selected." }, { status: 400 });
  }
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET_NAME) {
    return Response.json({ error: "Storage not configured." }, { status: 500 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);
  const gSnap = await galleryRef.get();
  if (!gSnap.exists) return Response.json({ error: "Gallery not found." }, { status: 404 });

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const { addStorage } = await import("@/lib/storage");

  const imported = [];
  const skipped  = [];

  for (const f of files) {
    const url = f?.url;
    if (!url) { skipped.push({ name: f?.label || "file", reason: "Missing file URL" }); continue; }
    const ext  = extFromUrl(url);
    const mime = MIME[ext] || "application/octet-stream";
    const base = (f.address || f.label || "floor-plan").toString().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
    const name = `${base}.${ext}`;

    try {
      const buf = await downloadFile(ctx.tenantId, url);
      if (buf.length > MAX_BYTES) { skipped.push({ name, reason: "File too large" }); continue; }

      const key = `floorplans/${ctx.tenantId}/${params.id}/${Date.now()}_${name}`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: buf, ContentType: mime }));
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

      await galleryRef.update({
        floorPlans: FieldValue.arrayUnion({
          url: publicUrl, key, fileName: name, fileType: mime,
          uploadedAt: new Date().toISOString(), source: "cubicasa",
        }),
      });
      try { await addStorage(ctx.tenantId, buf.length, "floorPlan"); } catch {}

      imported.push({ url: publicUrl, key, fileName: name, fileType: mime });
    } catch (e) {
      console.error("[import-cubicasa]", name, e?.message);
      skipped.push({ name, reason: "Import failed" });
    }
  }

  return Response.json({
    ok: imported.length > 0,
    imported, skipped,
    importedCount: imported.length, skippedCount: skipped.length,
  });
}
