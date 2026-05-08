import archiver from "archiver";
import sharp from "sharp";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 85;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const format = searchParams.get("format") || "web"; // "web" | "print"
  const extras = searchParams.get("extras") === "true"; // include floor plans, files, links.txt

  if (!token) return new Response("Missing params", { status: 400 });

  // 5 zip downloads per token per IP per hour — prevents bulk scraping
  const rl = await rateLimit(req, `zip-dl:${token}`, 5, 3600);
  if (rl.limited) return new Response("Too many download requests. Please try again later.", { status: 429 });

  // Resolve gallery via top-level index (avoids cross-tenant token collision)
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return new Response("Gallery not found", { status: 404 });

  const { tenantId, galleryId } = tokenDoc.data();
  const [galleryDoc, tenantDoc] = await Promise.all([
    adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get(),
    adminDb.collection("tenants").doc(tenantId).get(),
  ]);

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

  // Cap zip downloads to 300 images to prevent memory/timeout overruns
  const MAX_ZIP_FILES = 300;
  const toProcess = images.slice(0, MAX_ZIP_FILES);

  // Fetch and process images in parallel batches of 10 to stay within timeout
  const BATCH = 10;
  const entries = [];
  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (img) => {
        const sourceRes = await fetch(`${r2Url}/${img.key}`);
        if (!sourceRes.ok) return null;
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
        return { buffer, fileName };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) entries.push(r.value);
    }
  }

  if (entries.length === 0) return new Response("Failed to fetch images", { status: 500 });

  // Fetch floor plans + attached files when extras=true
  const extraEntries = [];
  let linksText = "";
  if (extras) {
    const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
    const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);
    const allExtras = [
      ...floorPlans.map((fp) => ({ ...fp, folder: "Floor Plans" })),
      ...attachedFiles.map((f) => ({ ...f, folder: "Extras" })),
    ];
    const extraResults = await Promise.allSettled(
      allExtras.map(async (item) => {
        const res = await fetch(`${r2Url}/${item.key}`);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return { buffer: buf, fileName: `${item.folder}/${item.fileName || item.key.split("/").pop()}` };
      })
    );
    for (const r of extraResults) {
      if (r.status === "fulfilled" && r.value) extraEntries.push(r.value);
    }

    // Build links.txt for tour/video URLs
    const lines = [];
    if (gallery.matterportUrl && !gallery.matterportHidden)
      lines.push(`3D Tour: ${gallery.matterportUrl}`);
    if (gallery.videoUrl && !gallery.videoUrlHidden)
      lines.push(`Video Tour: ${gallery.videoUrl}`);
    for (const l of (gallery.virtualLinks || []).filter((l) => !l.hidden))
      lines.push(`${l.label || "Virtual Tour"}: ${l.url}`);
    if (lines.length) linksText = lines.join("\n");
  }

  // Build zip in memory using archiver
  const zipBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("data",  (chunk) => chunks.push(chunk));
    archive.on("end",   () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    const photoFolder = extras ? "Photos/" : "";
    for (const { buffer, fileName } of entries) {
      archive.append(buffer, { name: `${photoFolder}${fileName}` });
    }
    for (const { buffer, fileName } of extraEntries) {
      archive.append(buffer, { name: fileName });
    }
    if (linksText) {
      archive.append(Buffer.from(linksText, "utf8"), { name: "Tour Links.txt" });
    }
    archive.finalize();
  });

  // Log bulk download activity — respects tenant's viewer tracking preference
  if (tenantDoc.data()?.gallerySettings?.viewerTracking !== false) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
    adminDb
      .collection("tenants").doc(tenantId)
      .collection("galleries").doc(galleryId)
      .collection("activityLog")
      .add({
        event:     "download_zip",
        format,
        fileCount: entries.length,
        timestamp: new Date(),
        ip,
      })
      .catch(() => {});
  }

  const address = (gallery.bookingAddress || "gallery").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const zipName = extras
    ? `${address}-package.zip`
    : `${address}-${format === "web" ? "web-ready" : "print"}.zip`;

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
