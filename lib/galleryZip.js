// Shared gallery-ZIP builder. Used by the prepared-download flow.
//
// IMPORTANT: videos are NEVER bundled here. They are the heavy bytes (up to 5 GB
// each) and download DIRECTLY from R2 via pre-signed URLs, where egress is free.
// Bundling them would force their bytes back through a server function (Vercel
// egress) on the R2 upload, defeating the purpose. This builder handles
// photos + floor plans + documents only.
//
// When a gallery is past its 1-year retention window, originals have already been
// replaced with web-sized files in the media records, so this builder naturally
// packages the web-sized versions (there is nothing else to fetch).

import crypto from "crypto";
import { isWebSized } from "@/lib/retention";

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 82;

// A stable hash over the file set + format. If the gallery's files change, the
// hash changes, which invalidates any previously-prepared ZIP for dedupe.
export function fileSetHash(gallery, format = "web") {
  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);
  const parts = [
    format,
    ...allMedia.filter((m) => !m.fileType?.startsWith("video/")).map((m) => `${m.key}:${m.size || 0}`),
    ...floorPlans.map((fp) => fp.key),
    ...attachedFiles.map((f) => f.key),
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

// Returns true if this gallery is "large/video-heavy" enough to warrant the
// prepared-download buffer rather than an immediate stream.
export function shouldPrepare(gallery) {
  const media  = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const videos = media.filter((m) => m.fileType?.startsWith("video/"));
  const photos = media.filter((m) => !m.fileType?.startsWith("video/"));
  const photoBytes = photos.reduce((s, m) => s + (Number(m.size) || 0), 0);
  // Heuristic: any videos at all (handled separately) OR a heavy photo set.
  return videos.length > 0 || photos.length > 250 || photoBytes > 1.5 * 1024 ** 3;
}

// Build the photos+floorplans+documents ZIP into a single Buffer.
export async function buildGalleryZipBuffer(gallery, { format = "web" } = {}) {
  const archiver = (await import("archiver")).default;
  const sharp    = (await import("sharp")).default;
  const r2Url    = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const photos        = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);

  const archive = archiver("zip", { zlib: { level: 4 } });
  const chunks  = [];
  archive.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  // Photos grouped by category folder.
  const catMap = new Map();
  for (const img of photos.slice(0, 500)) {
    const cat = (img.category || "").trim() || "Photos";
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push(img);
  }
  for (const [cat, items] of catMap) {
    const folder = cat.replace(/[/\\?%*:|"<>]/g, "-").trim();
    for (const img of items) {
      try {
        const res = await fetch(`${r2Url}/${img.key}`);
        if (!res.ok) continue;
        const buffer   = Buffer.from(await res.arrayBuffer());
        const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");
        // If the file is already web-sized (e.g. past retention), ship as-is.
        if (format === "web" && !isWebSized(img)) {
          const webBuf = await sharp(buffer)
            .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
            .jpeg({ quality: WEB_QUALITY, progressive: true })
            .toBuffer();
          archive.append(webBuf, { name: `${folder}/${baseName}-MLS.jpg` });
        } else {
          archive.append(buffer, { name: `${folder}/${img.fileName || "photo.jpg"}` });
        }
      } catch { /* skip */ }
    }
  }

  // Floor plans + documents (always included, never resized).
  for (const fp of floorPlans) {
    try {
      const res = await fetch(`${r2Url}/${fp.key}`);
      if (!res.ok) continue;
      archive.append(Buffer.from(await res.arrayBuffer()), {
        name: `Floor Plans/${fp.fileName || fp.key.split("/").pop()}`,
      });
    } catch { /* skip */ }
  }
  for (const file of attachedFiles) {
    try {
      const res = await fetch(`${r2Url}/${file.key}`);
      if (!res.ok) continue;
      archive.append(Buffer.from(await res.arrayBuffer()), {
        name: `Documents/${file.fileName || file.key.split("/").pop()}`,
      });
    } catch { /* skip */ }
  }

  // Video pointer + tour links.
  const videos = allMedia.filter((m) => m.fileType?.startsWith("video/"));
  if (videos.length > 0) {
    archive.append(
      Buffer.from(
        `This package includes ${videos.length} video${videos.length !== 1 ? "s" : ""}.\n` +
        `Videos download separately at full quality from the gallery page.\n`,
        "utf8"
      ),
      { name: "Videos/READ ME — videos download separately.txt" }
    );
  }

  archive.finalize();
  await done;
  return Buffer.concat(chunks);
}
