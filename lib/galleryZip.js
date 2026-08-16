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
const LAYOUT_VERSION = "v4-full-videos";

// A stable hash over the file set + format. If ANYTHING that affects the ZIP's
// contents or names changes — a file is added, replaced, deleted, renamed,
// recategorized, reordered, or its web/1080p derivative appears — the hash
// changes. The background builder treats a gallery whose current hash differs
// from its last-built hash as "outdated" and rebuilds it, so invalidation is
// automatic and needs no hooks in the mutation endpoints.
export function fileSetHash(gallery, format = "web", autoRename = false) {
  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);
  // Linked URLs that ship inside the package as Links/*.txt — the Matterport tour,
  // any 3D/virtual tours, a linked (YouTube/Vimeo) video the studio added instead
  // of uploading a file, and the property-website toggle. These change what the
  // agent receives, so a linked video/tour being added, removed, hidden, or edited
  // must invalidate the package exactly like changing a downloadable file does.
  const linkSig = [
    gallery.matterportHidden ? "" : (gallery.matterportUrl || ""),
    gallery.cubeCasaUrl || "",
    gallery.videoUrlHidden ? "" : (gallery.videoUrl || ""),
    gallery.showPropertyWebsiteLink === false ? "no-site" : "site",
    ...(gallery.virtualLinks || [])
      .filter((l) => !l.hidden && l.url)
      .map((l) => `${l.label || ""}=${l.url}`),
  ].join(",");
  const parts = [
    LAYOUT_VERSION,
    autoRename ? "renamed" : "original",
    format,
    // Key + size + display name + category + the derived web photo / 1080p video
    // keys. Order is captured by array order (reordering changes the hash).
    ...allMedia.map((m) =>
      `${m.key}:${m.size || 0}:${m.fileName || ""}:${m.category || ""}:${m.webKey || ""}:` +
      `${m.originalRemoved ? m.webVideoKey || "rm" : m.webVideoKey || ""}`
    ),
    ...floorPlans.map((fp) => `${fp.key}:${fp.fileName || ""}:${fp.webKey || ""}`),
    ...attachedFiles.map((f) => `${f.key}:${f.fileName || ""}`),
    `links:${linkSig}`,
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

  // Linked video — a YouTube/Vimeo (or other) URL the studio added instead of
  // uploading an actual video file. We can't bundle the bytes, so the package
  // includes the video's name + URL. (Uploaded MP4/MOV files live in media[] and
  // are bundled/linked separately by the manifest.)
  if (gallery.videoUrl && !gallery.videoUrlHidden) {
    files.push({
      name: `${ROOT}/Links/Video-Link.txt`,
      content: `${gallery.videoTitle || gallery.videoName || "Property Video"}\n${gallery.videoUrl}\n`,
    });
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

  // Full-resolution video originals — stable direct-download links. The 1080p web
  // versions are bundled in the ZIP's Videos/ folder; the full-res originals are
  // huge, so they're delivered as direct downloads. The video-download endpoint
  // 302-redirects to a fresh presigned R2 URL on each click, so these links never
  // expire and the bytes never pass through our servers.
  if (separateVideos.length > 0) {
    const list = separateVideos
      .map((v, i) => {
        const label = v.fileName || v.key?.split("/").pop() || `video-${i + 1}`;
        const dlKey = effectiveVideo(v).key;
        const url = token
          ? `${appUrl}/api/gallery/video-download?token=${token}&key=${encodeURIComponent(dlKey)}&name=${encodeURIComponent(label)}`
          : "";
        return url ? `  ${i + 1}. ${label}\n     ${url}` : `  ${i + 1}. ${label}`;
      })
      .join("\n");
    files.push({
      name: `${ROOT}/Links/Full-Resolution-Videos.txt`,
      content:
        `FULL-RESOLUTION VIDEOS\n\n` +
        `The 1080p web versions of your videos are already included in the Videos/\n` +
        `folder of this package. The full-resolution originals are very large, so\n` +
        `they download directly at full quality from the links below (each streams\n` +
        `straight from storage and does not expire):\n\n` +
        `${list}\n\n` +
        (slug && token ? `Or open the gallery: ${appUrl}/${slug}/gallery/${token}\n` : ""),
    });
  }

  return files;
}

// Build the complete-listing MANIFEST: the exact list of source R2 objects and
// the path each should occupy inside the ZIP, plus the Links/ text files. This is
// the single source of truth for the package's folder layout and file naming —
// the Cloudflare Worker consumes this manifest to stream each object from R2 into
// the ZIP, so all naming/retention logic stays here (never duplicated Worker-side).
//
// Package contents:
//   Photos/Print Ready/   full-resolution originals
//   Photos/Web Ready/     2048px MLS versions (pre-generated m.webKey)
//   Floor Plans/          originals (+ Web Ready when a webKey exists)
//   Documents/            attached files
//   Videos/               FULL-RESOLUTION originals (1080p only if the original
//                         was stripped by retention)
//   Links/                Matterport / 3D tour / property site / gallery links
//
// Returns { entries: [{ key, path }], linkFiles: [{ name, content }] }.
export function buildGalleryManifest(gallery, opts = {}) {
  const { slug, token, bookingId, autoRename = false } = opts;
  const counters = new Map();
  const entries = [];

  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const photos        = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos        = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);

  // ── Photos: Print Ready (original) + Web Ready (pre-made MLS) ──
  for (const img of photos.slice(0, 2000)) {
    const cat  = (img.category || "").trim() || "Photos";
    const safe = cat.replace(/[/\\?%*:|"<>]/g, "-").trim();
    const sub  = (safe && safe !== "Photos") ? `${safe}/` : "";
    const catLabel = sub ? safe : null;
    const ext      = (img.fileName?.match(/\.[^.]+$/)?.[0]) || ".jpg";
    const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");

    const prDir  = `Photos/Print Ready/${sub}`;
    const prName = autoRename
      ? seqName(counters, prDir, `${catLabel || "Print Ready"} Photo `, ext)
      : (img.fileName || "photo.jpg");
    entries.push({ key: img.key, path: `${ROOT}/${prDir}${prName}` });

    // Web Ready — the pre-generated 2048px MLS version. Skipped if it hasn't been
    // generated yet (a fresh upload the cron hasn't processed); the next build
    // once the webKey exists will include it (and the hash change re-triggers it).
    const wKey = img.webKey || (isWebSized(img) ? img.key : null);
    if (wKey && wKey !== img.key) {
      const wrDir  = `Photos/Web Ready/${sub}`;
      const wrName = autoRename
        ? seqName(counters, wrDir, `${catLabel || "Web Ready"} Photo `, ".jpg")
        : `${baseName}-MLS.jpg`;
      entries.push({ key: wKey, path: `${ROOT}/${wrDir}${wrName}` });
    }
  }

  // ── Floor Plans ──
  for (const fp of floorPlans) {
    const fpName = fp.fileName || fp.key.split("/").pop() || "floor-plan";
    entries.push({ key: fp.key, path: `${ROOT}/Floor Plans/${fpName}` });
    if (fp.webKey) {
      entries.push({ key: fp.webKey, path: `${ROOT}/Floor Plans/Web Ready/${fpName.replace(/\.[^.]+$/, "")}-web.jpg` });
    }
  }

  // ── Documents ──
  for (const file of attachedFiles) {
    entries.push({ key: file.key, path: `${ROOT}/Documents/${file.fileName || file.key.split("/").pop()}` });
  }

  // ── Videos: FULL-RESOLUTION originals inside the ZIP. Only fall back to the
  // 1080p web version when the original has been stripped by 1-year retention. ──
  for (const v of videos) {
    const name   = v.fileName || v.key.split("/").pop() || "video.mp4";
    const srcKey = (v.originalRemoved && v.webVideoKey) ? v.webVideoKey : v.key;
    if (!srcKey) continue;
    entries.push({ key: srcKey, path: `${ROOT}/Videos/${name}` });
  }

  // ── Links — Matterport / 3D / property site / gallery ONLY. Videos live in the
  // ZIP now, so there is no video-links file (separateVideos: []). ──
  const linkFiles = buildLinkFiles(gallery, { slug, token, bookingId, separateVideos: [] });

  return { entries, linkFiles };
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

// Build the COMPLETE listing package as a streaming archive (a Node Readable the
// caller pipes straight to R2 via multipart upload). Unlike buildGalleryZipBuffer,
// this never holds the whole ZIP in memory and never runs Sharp/ffmpeg — it uses
// the PRE-GENERATED web photo (m.webKey) and 1080p video (m.webVideoKey) assets,
// streaming every source object from R2 with no recompression (store). That keeps
// memory flat regardless of ZIP size and keeps the build fast.
//
// Package contents:
//   Photos/Print Ready/   full-resolution originals
//   Photos/Web Ready/     2048px MLS versions (from m.webKey)
//   Floor Plans/          originals (+ Web Ready when a webKey exists)
//   Documents/            attached files
//   Videos/               1080p web versions (from m.webVideoKey)
//   Links/                full-res video direct links, Matterport, site, gallery
//
// This is meant to run inside the background build cron, never inside a client
// request.
export async function buildGalleryZipStream(gallery, opts = {}) {
  const { slug, token, bookingId, autoRename = false } = opts;
  const archiver = (await import("archiver")).default;
  const { Readable } = await import("stream");
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  const counters = new Map();

  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const photos        = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos        = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);

  // store: media (JPEG/MP4/PDF) is already compressed, so we skip recompression.
  const archive = archiver("zip", { store: true });

  // Drive the appends concurrently. archiver queues each entry and applies
  // backpressure to its own output stream, so memory stays bounded to roughly one
  // source object at a time. finalize() writes the central directory last.
  (async () => {
    try {
      const appendKey = async (key, name) => {
        try {
          const res = await fetch(`${r2Url}/${key}`);
          if (!res.ok || !res.body) return false;
          archive.append(Readable.fromWeb(res.body), { name });
          return true;
        } catch { return false; }
      };

      // ── Photos: Print Ready (original) + Web Ready (pre-made MLS) ──
      for (const img of photos.slice(0, 1000)) {
        const cat  = (img.category || "").trim() || "Photos";
        const safe = cat.replace(/[/\\?%*:|"<>]/g, "-").trim();
        const sub  = (safe && safe !== "Photos") ? `${safe}/` : "";
        const catLabel = sub ? safe : null;
        const ext      = (img.fileName?.match(/\.[^.]+$/)?.[0]) || ".jpg";
        const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");

        // Print Ready — full-resolution original (or the web-sized file if the
        // original was stripped by retention).
        const prDir  = `Photos/Print Ready/${sub}`;
        const prName = autoRename
          ? seqName(counters, prDir, `${catLabel || "Print Ready"} Photo `, ext)
          : (img.fileName || "photo.jpg");
        await appendKey(img.key, `${ROOT}/${prDir}${prName}`);

        // Web Ready — the pre-generated 2048px MLS version. Skip if it hasn't been
        // generated yet (a fresh upload the cron hasn't processed); the next build
        // once it's ready will include it.
        const wKey = img.webKey || (isWebSized(img) ? img.key : null);
        if (wKey && wKey !== img.key) {
          const wrDir  = `Photos/Web Ready/${sub}`;
          const wrName = autoRename
            ? seqName(counters, wrDir, `${catLabel || "Web Ready"} Photo `, ".jpg")
            : `${baseName}-MLS.jpg`;
          await appendKey(wKey, `${ROOT}/${wrDir}${wrName}`);
        }
      }

      // ── Floor Plans ──
      for (const fp of floorPlans) {
        const fpName = fp.fileName || fp.key.split("/").pop() || "floor-plan";
        await appendKey(fp.key, `${ROOT}/Floor Plans/${fpName}`);
        if (fp.webKey) {
          await appendKey(fp.webKey, `${ROOT}/Floor Plans/Web Ready/${fpName.replace(/\.[^.]+$/, "")}-web.jpg`);
        }
      }

      // ── Documents ──
      for (const file of attachedFiles) {
        await appendKey(file.key, `${ROOT}/Documents/${file.fileName || file.key.split("/").pop()}`);
      }

      // ── Videos: 1080p web version bundled; full-res original delivered via link ──
      const separateOriginals = [];
      for (const v of videos) {
        const name    = v.fileName || v.key.split("/").pop() || "video.mp4";
        const base    = name.replace(/\.[^.]+$/, "");
        const webKey  = v.webVideoKey || (v.originalRemoved ? v.key : null);
        if (webKey && v.webVideoStatus !== "failed") {
          await appendKey(webKey, `${ROOT}/Videos/${base}-1080p.mp4`);
        }
        if (!v.originalRemoved) separateOriginals.push(v);
      }

      // ── Links (full-res video direct links + Matterport/site/gallery) ──
      for (const lf of buildLinkFiles(gallery, { slug, token, bookingId, separateVideos: separateOriginals })) {
        archive.append(Buffer.from(lf.content, "utf8"), { name: lf.name });
      }

      archive.finalize();
    } catch (err) {
      archive.destroy(err);
    }
  })();

  return archive;
}
