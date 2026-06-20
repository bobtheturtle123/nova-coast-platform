// Shared gallery-ZIP builder used by the prepared-download flow.
//
// The ZIP is organized so a client feels like "Download All" gives them
// everything, while the backend stays safe (no massive ZIPs / timeouts):
//
//   Listing Media Package/
//     Photos/
//     Floor Plans/
//     Documents/
//     Videos/                      ← only videos small enough to bundle safely
//     Links/
//       Matterport-Link.txt
//       3D-Tour-Link.txt
//       Property-Website-Link.txt
//       Gallery-Links.txt
//       Video-Download-Links.txt   ← present when any video is delivered separately
//
// VIDEO STRATEGY: small videos are bundled into Videos/. Large videos are NOT
// forced into the ZIP (that's what causes massive archives, memory blowups, and
// timeouts) — they download DIRECTLY from R2 via pre-signed URLs, and the ZIP
// includes a Links/Video-Download-Links.txt pointing back to the gallery so the
// client can grab them. Matterport/3D/website/gallery links are always link
// files, never downloaded as media.
//
// When a gallery is past its 1-year retention window, photo originals have been
// replaced with web-sized files in the media records, so this builder naturally
// packages the web-sized versions.

import crypto from "crypto";
import { isWebSized } from "@/lib/retention";
import { getAppUrl } from "@/lib/appUrl";

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 82;

const ROOT = "Listing Media Package";

// Video bundling thresholds. Small videos ride along in the ZIP; anything larger
// (or of unknown size) is delivered as a separate direct download. The total
// budget bounds memory in the buffered build path.
const SMALL_VIDEO_BYTES   = 150 * 1024 * 1024; // 150 MB per video
const IN_ZIP_VIDEO_BUDGET = 500 * 1024 * 1024; // 500 MB total bundled

// Effective deliverable size/key for a video: after 1-year retention the
// full-res original is gone, so we deal with the 1080p web version.
export function effectiveVideo(v = {}) {
  if (v.originalRemoved && v.webVideoKey) {
    return { key: v.webVideoKey, size: Number(v.webVideoBytes) || 0 };
  }
  return { key: v.key, size: Number(v.size) || 0 };
}

// Split videos into those small enough to bundle vs. those delivered separately.
export function partitionVideos(videos = []) {
  const inZip = [], separate = [];
  let budget = IN_ZIP_VIDEO_BUDGET;
  for (const v of videos) {
    const { size } = effectiveVideo(v);
    if (size > 0 && size <= SMALL_VIDEO_BYTES && size <= budget) {
      inZip.push(v);
      budget -= size;
    } else {
      separate.push(v);
    }
  }
  return { inZip, separate };
}

// Bump when the ZIP's internal folder layout changes, so previously-prepared
// (cached) ZIPs are invalidated and rebuilt with the new structure.
const LAYOUT_VERSION = "v2-photos-nested";

// A stable hash over the file set + format. If the gallery's files change, the
// hash changes, which invalidates any previously-prepared ZIP for dedupe.
export function fileSetHash(gallery, format = "web", autoRename = false) {
  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);
  const parts = [
    LAYOUT_VERSION,
    autoRename ? "renamed" : "original",
    format,
    // Include videos; reflect the web-version swap so a stale prepared ZIP
    // built from a now-removed original is invalidated.
    ...allMedia.map((m) => `${m.key}:${m.size || 0}:${m.originalRemoved ? m.webVideoKey || "rm" : ""}`),
    ...floorPlans.map((fp) => fp.key),
    ...attachedFiles.map((f) => f.key),
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

// Sequential download-name helper. When a tenant enables auto-rename, files are
// numbered consecutively within each folder using a caller-supplied prefix
// (e.g. "Print Ready Photo " -> "Print Ready Photo 1.jpg"). `counters` is a Map
// the caller keeps for one ZIP build so numbering is per-folder and stable.
export function seqName(counters, key, prefix, ext) {
  const n = (counters.get(key) || 0) + 1;
  counters.set(key, n);
  return `${prefix}${n}${ext || ""}`;
}

// Returns true if this gallery is "large/video-heavy" enough to warrant the
// prepared-download buffer rather than an immediate stream.
export function shouldPrepare(gallery) {
  const media  = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const videos = media.filter((m) => m.fileType?.startsWith("video/"));
  const photos = media.filter((m) => !m.fileType?.startsWith("video/"));
  const photoBytes = photos.reduce((s, m) => s + (Number(m.size) || 0), 0);
  return videos.length > 0 || photos.length > 250 || photoBytes > 1.5 * 1024 ** 3;
}

// Build the Links/ text files for a gallery. Returns [{ name, content }] where
// `name` is the path under the ROOT folder. Only non-empty files are returned.
// `separateVideos` are the videos delivered outside the ZIP (listed for the client).
export function buildLinkFiles(gallery, { slug, token, bookingId, separateVideos = [] } = {}) {
  const appUrl = getAppUrl();
  const files = [];

  // Matterport
  if (gallery.matterportUrl && !gallery.matterportHidden) {
    files.push({
      name: `${ROOT}/Links/Matterport-Link.txt`,
      content: `Matterport 3D Tour\n${gallery.matterportUrl}\n`,
    });
  }

  // Other 3D / virtual tours (CubiCasa floor-plan tour + any custom virtual links)
  const tourLines = [];
  if (gallery.cubeCasaUrl) tourLines.push(`Interactive Floor Plan: ${gallery.cubeCasaUrl}`);
  for (const l of (gallery.virtualLinks || []).filter((l) => !l.hidden && l.url)) {
    tourLines.push(`${l.label || "Virtual Tour"}: ${l.url}`);
  }
  if (tourLines.length) {
    files.push({ name: `${ROOT}/Links/3D-Tour-Link.txt`, content: tourLines.join("\n") + "\n" });
  }

  // Property website / brochure — only when the studio chose to include it.
  // If the website isn't included, we don't add any link to it at all.
  if (slug && bookingId && gallery.showPropertyWebsiteLink !== false) {
    const siteLines = [
      `Property Website: ${appUrl}/${slug}/property/${bookingId}`,
      `Property Brochure: ${appUrl}/${slug}/property/${bookingId}/brochure`,
    ];
    files.push({ name: `${ROOT}/Links/Property-Website-Link.txt`, content: siteLines.join("\n") + "\n" });
  }

  // Gallery link(s)
  if (slug && token) {
    files.push({
      name: `${ROOT}/Links/Gallery-Links.txt`,
      content: `Online Gallery: ${appUrl}/${slug}/gallery/${token}\n`,
    });
  }

  // Video download pointer (only when videos are delivered separately)
  if (separateVideos.length > 0) {
    const list = separateVideos
      .map((v, i) => `  ${i + 1}. ${v.fileName || v.key?.split("/").pop() || `video-${i + 1}`}`)
      .join("\n");
    files.push({
      name: `${ROOT}/Links/Video-Download-Links.txt`,
      content:
        `These videos are delivered as separate direct downloads to keep delivery\n` +
        `fast and reliable. Open the gallery and click "Download Everything" — each\n` +
        `video downloads at full quality directly:\n\n` +
        (slug && token ? `  ${appUrl}/${slug}/gallery/${token}\n\n` : "") +
        `Videos:\n${list}\n`,
    });
  }

  return files;
}

// Build the photos + floor plans + documents (+ small videos + link files) ZIP
// into a single Buffer.
export async function buildGalleryZipBuffer(gallery, opts = {}) {
  const { format = "web", slug, token, bookingId, autoRename = false } = opts;
  // Per-folder counters for sequential auto-renaming (when enabled).
  const counters = new Map();
  const archiver = (await import("archiver")).default;
  const sharp    = (await import("sharp")).default;
  const r2Url    = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const photos        = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos        = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);

  // Videos are delivered as direct R2 downloads (free egress, no function
  // bandwidth or timeout), never buffered into this in-memory ZIP. They're
  // listed in Links/Video-Download-Links.txt so the package references them.
  const smallVideos = [];
  const separateVideos = videos;

  const archive = archiver("zip", { zlib: { level: 4 } });
  const chunks  = [];
  archive.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  // ── Photos (grouped by category folder) ──────────────────────────────────
  const catMap = new Map();
  for (const img of photos.slice(0, 500)) {
    const cat = (img.category || "").trim() || "Photos";
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push(img);
  }
  for (const [cat, items] of catMap) {
    const safe = cat.replace(/[/\\?%*:|"<>]/g, "-").trim();
    // Only nest a category subfolder for real categories — uncategorized photos
    // (default "Photos") go straight into the parent so we never get .../Photos/Photos.
    const sub  = (safe && safe !== "Photos") ? `${safe}/` : "";
    for (const img of items) {
      try {
        const res = await fetch(`${r2Url}/${img.key}`);
        if (!res.ok) continue;
        const buffer   = Buffer.from(await res.arrayBuffer());
        const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");
        const ext      = (img.fileName?.match(/\.[^.]+$/)?.[0]) || ".jpg";
        const catLabel = sub ? safe : null; // inside a real category subfolder?
        if (format === "package") {
          // Both variants: full-res Print Ready + resized Web Ready.
          const webBuf = await sharp(buffer)
            .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
            .jpeg({ quality: WEB_QUALITY, progressive: true })
            .toBuffer();
          const prDir = `Photos/Print Ready/${sub}`;
          const wrDir = `Photos/Web Ready/${sub}`;
          const prName = autoRename
            ? seqName(counters, prDir, `${catLabel || "Print Ready"} Photo `, ext)
            : (img.fileName || "photo.jpg");
          const wrName = autoRename
            ? seqName(counters, wrDir, `${catLabel || "Web Ready"} Photo `, ".jpg")
            : `${baseName}-MLS.jpg`;
          archive.append(buffer, { name: `${ROOT}/${prDir}${prName}` });
          archive.append(webBuf, { name: `${ROOT}/${wrDir}${wrName}` });
        } else if (format === "web" && !isWebSized(img)) {
          const webBuf = await sharp(buffer)
            .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
            .jpeg({ quality: WEB_QUALITY, progressive: true })
            .toBuffer();
          const dir  = `Photos/${sub}`;
          const name = autoRename
            ? seqName(counters, dir, catLabel ? `${catLabel} Photo ` : "Photo ", ".jpg")
            : `${baseName}-MLS.jpg`;
          archive.append(webBuf, { name: `${ROOT}/${dir}${name}` });
        } else {
          const dir  = `Photos/${sub}`;
          const name = autoRename
            ? seqName(counters, dir, catLabel ? `${catLabel} Photo ` : "Photo ", ext)
            : (img.fileName || "photo.jpg");
          archive.append(buffer, { name: `${ROOT}/${dir}${name}` });
        }
      } catch { /* skip */ }
    }
  }

  // ── Floor Plans ──────────────────────────────────────────────────────────
  // Delivered alongside photos in the same Print Ready / Web Ready structure.
  for (const fp of floorPlans) {
    try {
      const res = await fetch(`${r2Url}/${fp.key}`);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const fpName = fp.fileName || fp.key.split("/").pop() || "floor-plan";
      const isImg  = /\.(jpe?g|png|webp|tiff?)$/i.test(fpName);
      const fpExt  = (fpName.match(/\.[^.]+$/)?.[0]) || "";
      if (format === "package") {
        const prName = autoRename ? seqName(counters, "fp/print", "Print Ready Floor Plan ", fpExt) : fpName;
        archive.append(buffer, { name: `${ROOT}/Floor Plans/Print Ready/${prName}` });
        if (isImg) {
          const baseName = fpName.replace(/\.[^.]+$/, "");
          const webBuf = await sharp(buffer)
            .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
            .jpeg({ quality: WEB_QUALITY, progressive: true })
            .toBuffer();
          const wrName = autoRename ? seqName(counters, "fp/web", "Web Ready Floor Plan ", ".jpg") : `${baseName}-web.jpg`;
          archive.append(webBuf, { name: `${ROOT}/Floor Plans/Web Ready/${wrName}` });
        } else {
          // PDFs / non-images: include the original in both folders.
          const wrName = autoRename ? seqName(counters, "fp/web", "Web Ready Floor Plan ", fpExt) : fpName;
          archive.append(buffer, { name: `${ROOT}/Floor Plans/Web Ready/${wrName}` });
        }
      } else {
        const name = autoRename ? seqName(counters, "fp/flat", "Floor Plan ", fpExt) : fpName;
        archive.append(buffer, { name: `${ROOT}/Floor Plans/${name}` });
      }
    } catch { /* skip */ }
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  for (const file of attachedFiles) {
    try {
      const res = await fetch(`${r2Url}/${file.key}`);
      if (!res.ok) continue;
      archive.append(Buffer.from(await res.arrayBuffer()), {
        name: `${ROOT}/Documents/${file.fileName || file.key.split("/").pop()}`,
      });
    } catch { /* skip */ }
  }

  // ── Small videos (bundled) ─────────────────────────────────────────────────
  for (const v of smallVideos) {
    try {
      const { key: vKey } = effectiveVideo(v);
      const res = await fetch(`${r2Url}/${vKey}`);
      if (!res.ok) continue;
      archive.append(Buffer.from(await res.arrayBuffer()), {
        name: `${ROOT}/Videos/${v.fileName || vKey.split("/").pop()}`,
      });
    } catch {
      // If a "small" video fails to bundle, fall back to treating it as separate.
      separateVideos.push(v);
    }
  }

  // ── Links/ ─────────────────────────────────────────────────────────────────
  for (const lf of buildLinkFiles(gallery, { slug, token, bookingId, separateVideos })) {
    archive.append(Buffer.from(lf.content, "utf8"), { name: lf.name });
  }

  archive.finalize();
  await done;
  return Buffer.concat(chunks);
}
