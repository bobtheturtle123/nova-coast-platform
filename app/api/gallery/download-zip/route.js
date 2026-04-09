import archiver from "archiver";
import sharp from "sharp";
import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

export const dynamic = "force-dynamic";

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 85;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const slug   = searchParams.get("slug");
  const format = searchParams.get("format") || "web"; // "web" | "print"

  if (!token || !slug) return new Response("Missing params", { status: 400 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response("Not found", { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("galleries")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return new Response("Gallery not found", { status: 404 });

  const gallery = snap.docs[0].data();
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
