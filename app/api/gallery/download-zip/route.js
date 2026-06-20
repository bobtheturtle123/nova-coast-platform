import archiver from "archiver";
import sharp from "sharp";
import { Readable } from "stream";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { buildLinkFiles, seqName } from "@/lib/galleryZip";

// Top-level folder so the client gets one tidy package.
const ROOT = "Listing Media Package";

// Convert a Web ReadableStream (fetch response body) to a Node.js Readable
// so archiver can pipe it directly without buffering the whole file.
function toNodeStream(webStream) {
  return Readable.fromWeb(webStream);
}

export const dynamic     = "force-dynamic";
export const maxDuration = 300; // Vercel Pro — 5 min max

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 82;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token  = searchParams.get("token");
  const format = searchParams.get("format") || "web"; // "web" | "print"
  const extras = searchParams.get("extras") === "true";

  if (!token) return new Response("Missing token", { status: 400 });

  const rl = await rateLimit(req, `zip-dl:${token}`, 5, 3600);
  if (rl.limited) return new Response("Too many download requests. Try again later.", { status: 429 });

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

  const slug  = tenantDoc.data()?.slug || null;
  const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;
  const counters = new Map(); // per-folder sequential counters for auto-rename
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2Url) return new Response("Storage not configured", { status: 500 });

  const allMedia      = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const photos        = allMedia.filter((m) => !m.fileType?.startsWith("video/"));
  const videos        = allMedia.filter((m) =>  m.fileType?.startsWith("video/"));
  const floorPlans    = (gallery.floorPlans    || []).filter((fp) => !fp.hidden && fp.key);
  const attachedFiles = (gallery.attachedFiles || []).filter((f)  => !f.hidden  && f.key);

  const address = (gallery.bookingAddress || "gallery").replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const zipName = extras
    ? `${address}-complete-package.zip`
    : `${address}-${format === "web" ? "web-ready" : "print"}.zip`;

  // Build archive and start streaming the response immediately.
  // Each file is fetched and appended one at a time so we never hold the
  // full gallery in memory at once.
  const archive = archiver("zip", { zlib: { level: 4 } });

  const readable = new ReadableStream({
    async start(controller) {
      archive.on("data",  (chunk) => controller.enqueue(new Uint8Array(chunk)));
      archive.on("end",   () => controller.close());
      archive.on("error", (err) => {
        console.error("[download-zip] archiver error:", err?.message || err);
        controller.error(err);
      });

      try {
        // ── Photos (grouped by category into folders) ────────────────────────
        const MAX_PHOTOS = 300;
        const photoSlice = photos.slice(0, MAX_PHOTOS);

        // Build an ordered map: category → items (preserving insertion order)
        const catMap = new Map();
        for (const img of photoSlice) {
          const cat = (img.category || "").trim() || "Photos";
          if (!catMap.has(cat)) catMap.set(cat, []);
          catMap.get(cat).push(img);
        }

        for (const [cat, items] of catMap) {
          // Sanitise the folder name; only nest real categories (uncategorized
          // photos default to "Photos" and go straight into the parent).
          const safe = cat.replace(/[/\\?%*:|"<>]/g, "-").trim();
          const sub  = (safe && safe !== "Photos") ? `${safe}/` : "";
          for (const img of items) {
            try {
              const res = await fetch(`${r2Url}/${img.key}`);
              if (!res.ok) continue;
              const buffer   = Buffer.from(await res.arrayBuffer());
              const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");
              const ext      = (img.fileName?.match(/\.[^.]+$/)?.[0]) || ".jpg";
              const catLabel = sub ? safe : null;

              if (extras) {
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
                archive.append(buffer,  { name: `${ROOT}/${prDir}${prName}` });
                archive.append(webBuf,  { name: `${ROOT}/${wrDir}${wrName}` });
              } else if (format === "web") {
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
            } catch (e) {
              console.warn("[download-zip] photo failed:", img.key, e?.message);
            }
          }
        }

        // ── Floor Plans ──────────────────────────────────────────────────────
        // In the full package, deliver them inside Print Ready / Web Ready too.
        for (const fp of floorPlans) {
          try {
            const res = await fetch(`${r2Url}/${fp.key}`);
            if (!res.ok) continue;
            const fpName = fp.fileName || fp.key.split("/").pop() || "floor-plan";
            const fpExt  = (fpName.match(/\.[^.]+$/)?.[0]) || "";
            if (extras) {
              const fpBuf = Buffer.from(await res.arrayBuffer());
              const prName = autoRename ? seqName(counters, "fp/print", "Print Ready Floor Plan ", fpExt) : fpName;
              archive.append(fpBuf, { name: `${ROOT}/Floor Plans/Print Ready/${prName}` });
              if (/\.(jpe?g|png|webp|tiff?)$/i.test(fpName)) {
                const baseName = fpName.replace(/\.[^.]+$/, "");
                const webBuf = await sharp(fpBuf)
                  .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
                  .jpeg({ quality: WEB_QUALITY, progressive: true })
                  .toBuffer();
                const wrName = autoRename ? seqName(counters, "fp/web", "Web Ready Floor Plan ", ".jpg") : `${baseName}-web.jpg`;
                archive.append(webBuf, { name: `${ROOT}/Floor Plans/Web Ready/${wrName}` });
              } else {
                const wrName = autoRename ? seqName(counters, "fp/web", "Web Ready Floor Plan ", fpExt) : fpName;
                archive.append(fpBuf, { name: `${ROOT}/Floor Plans/Web Ready/${wrName}` });
              }
            } else if (res.body) {
              const name = autoRename ? seqName(counters, "fp/flat", "Floor Plan ", fpExt) : fpName;
              archive.append(toNodeStream(res.body), { name: `${ROOT}/Floor Plans/${name}` });
            }
          } catch (e) {
            console.warn("[download-zip] floor plan failed:", fp.key, e?.message);
          }
        }

        // ── Documents / Attached Files ───────────────────────────────────────
        for (const file of attachedFiles) {
          try {
            const res = await fetch(`${r2Url}/${file.key}`);
            if (!res.ok || !res.body) continue;
            archive.append(toNodeStream(res.body), {
              name: `${ROOT}/Documents/${file.fileName || file.key.split("/").pop()}`,
            });
          } catch (e) {
            console.warn("[download-zip] file failed:", file.key, e?.message);
          }
        }

        // ── Videos ───────────────────────────────────────────────────────────
        // Videos are intentionally NOT streamed through this function. Routing
        // heavy video bytes through Vercel would add bandwidth cost and risk the
        // 300s timeout under load. They download DIRECTLY from R2 on the client
        // (free egress, unlimited concurrency). The Links file references them.

        // ── Links/ (Matterport, 3D tour, property website, gallery, videos) ──
        for (const lf of buildLinkFiles(gallery, { slug, token, bookingId: gallery.bookingId, separateVideos: videos })) {
          archive.append(Buffer.from(lf.content, "utf8"), { name: lf.name });
        }

      } catch (outerErr) {
        console.error("[download-zip] processing error:", outerErr?.message || outerErr);
      }

      archive.finalize();
    },
  });

  // Log activity (fire-and-forget — don't block the stream)
  if (tenantDoc.data()?.gallerySettings?.viewerTracking !== false) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
             || req.headers.get("x-real-ip") || null;
    (async () => {
      let viewerEmail = null, viewerName = null;
      try {
        if (gallery.bookingId) {
          const b = await adminDb.collection("tenants").doc(tenantId).collection("bookings").doc(gallery.bookingId).get();
          if (b.exists) { viewerEmail = b.data().clientEmail || null; viewerName = b.data().clientName || null; }
        }
      } catch {}
      adminDb
        .collection("tenants").doc(tenantId)
        .collection("galleries").doc(galleryId)
        .collection("activityLog")
        .add({
          event:     "download_zip",
          format:    extras ? "package" : format,
          fileCount: (gallery.media || []).length,
          timestamp: new Date(),
          viewerEmail, viewerName, ip,
        })
        .catch(() => {});
    })();
  }

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control":       "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
