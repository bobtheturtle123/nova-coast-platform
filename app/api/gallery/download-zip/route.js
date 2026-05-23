import archiver from "archiver";
import sharp from "sharp";
import { Readable } from "stream";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

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
        // ── Photos ──────────────────────────────────────────────────────────
        const MAX_PHOTOS = 300;
        for (const img of photos.slice(0, MAX_PHOTOS)) {
          try {
            const res = await fetch(`${r2Url}/${img.key}`);
            if (!res.ok) continue;
            const buffer   = Buffer.from(await res.arrayBuffer());
            const baseName = (img.fileName || "photo").replace(/\.[^.]+$/, "");

            if (extras) {
              const webBuf = await sharp(buffer)
                .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
                .jpeg({ quality: WEB_QUALITY, progressive: true })
                .toBuffer();
              archive.append(buffer,  { name: `Photos/Print/${img.fileName || "photo.jpg"}` });
              archive.append(webBuf,  { name: `Photos/Web-MLS/${baseName}-MLS.jpg` });
            } else if (format === "web") {
              const webBuf = await sharp(buffer)
                .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
                .jpeg({ quality: WEB_QUALITY, progressive: true })
                .toBuffer();
              archive.append(webBuf, { name: `${baseName}-MLS.jpg` });
            } else {
              // Print: use the already-fetched buffer (no resize)
              archive.append(buffer, { name: img.fileName || "photo.jpg" });
            }
          } catch (e) {
            console.warn("[download-zip] photo failed:", img.key, e?.message);
          }
        }

        // ── Videos (streamed — can be very large) ───────────────────────────
        for (const vid of videos) {
          try {
            const res = await fetch(`${r2Url}/${vid.key}`);
            if (!res.ok || !res.body) continue;
            const folder = extras ? "Videos/" : "";
            archive.append(toNodeStream(res.body), {
              name: `${folder}${vid.fileName || vid.key.split("/").pop()}`,
            });
          } catch (e) {
            console.warn("[download-zip] video failed:", vid.key, e?.message);
          }
        }

        // ── Floor Plans ──────────────────────────────────────────────────────
        for (const fp of floorPlans) {
          try {
            const res = await fetch(`${r2Url}/${fp.key}`);
            if (!res.ok || !res.body) continue;
            archive.append(toNodeStream(res.body), {
              name: `Floor Plans/${fp.fileName || fp.key.split("/").pop()}`,
            });
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
              name: `Documents/${file.fileName || file.key.split("/").pop()}`,
            });
          } catch (e) {
            console.warn("[download-zip] file failed:", file.key, e?.message);
          }
        }

        // ── Tour Links text file ─────────────────────────────────────────────
        const lines = [];
        if (gallery.matterportUrl && !gallery.matterportHidden)
          lines.push(`3D Tour: ${gallery.matterportUrl}`);
        if (gallery.videoUrl && !gallery.videoUrlHidden)
          lines.push(`Video Tour: ${gallery.videoUrl}`);
        for (const l of (gallery.virtualLinks || []).filter((l) => !l.hidden))
          lines.push(`${l.label || "Virtual Tour"}: ${l.url}`);
        if (lines.length) {
          archive.append(Buffer.from(lines.join("\n"), "utf8"), { name: "Tour Links.txt" });
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
    adminDb
      .collection("tenants").doc(tenantId)
      .collection("galleries").doc(galleryId)
      .collection("activityLog")
      .add({
        event:     "download_zip",
        format:    extras ? "package" : format,
        fileCount: (gallery.media || []).length,
        timestamp: new Date(),
        ip,
      })
      .catch(() => {});
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
