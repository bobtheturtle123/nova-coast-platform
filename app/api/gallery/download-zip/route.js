import archiver from "archiver";
import sharp from "sharp";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 85;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const format = searchParams.get("format") || "web"; // "web" | "print"

  if (!token) return new Response("Missing params", { status: 400 });

  // Resolve gallery via top-level index (avoids cross-tenant token collision)
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return new Response("Gallery not found", { status: 404 });

  const { tenantId, galleryId } = tokenDoc.data();
  const galleryDoc = await adminDb
    .collection("tenants").doc(tenantId)
    .collection("galleries").doc(galleryId)
    .get();

  if (!galleryDoc.exists) return new Response("Gallery not found", { status: 404 });

  const gallery = galleryDoc.data();
  if (gallery.accessToken !== token) return new Response("Gallery not found", { status: 404 });
  if (!gallery.unlocked) return new Response("Gallery is locked", { status: 403 });

  const images = (gallery.media || []).filter(
    (m) => m.key && !m.fileType?.startsWith("video/")
  );

  if (images.length === 0) return new Response("No images", { status: 404 });

  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2Url) return new Response("Storage not configured", { status: 500 });

  // Collect all processed image buffers
  const entries = [];
  for (const img of images) {
    try {
      const sourceRes = await fetch(`${r2Url}/${img.key}`);
      if (!sourceRes.ok) continue;

      const arrayBuffer = await sourceRes.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      const baseName = (img.fileName || "image").replace(/\.[^.]+$/, "");
      let fileName;

      if (format === "web") {
        buffer = await sharp(buffer)
          .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
          .jpeg({ quality: WEB_QUALITY, progressive: true })
          .toBuffer();
        fileName = `${baseName}-MLS.jpg`;
      } else {
        fileName = img.fileName || "image.jpg";
      }

      entries.push({ buffer, fileName });
    } catch {
      // Skip failed images
    }
  }

  if (entries.length === 0) return new Response("Failed to fetch images", { status: 500 });

  // Build zip in memory using archiver
  const zipBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("data",  (chunk) => chunks.push(chunk));
    archive.on("end",   () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    for (const { buffer, fileName } of entries) {
      archive.append(buffer, { name: fileName });
    }
    archive.finalize();
  });

  const address = (gallery.bookingAddress || "gallery").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const zipName = `${address}-${format === "web" ? "web-ready" : "print"}.zip`;

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length":      String(zipBuffer.length),
      "Cache-Control":       "private, no-store",
    },
  });
}
