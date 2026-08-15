import { rateLimit } from "@/lib/rateLimit";
import { webPhotoKey } from "@/lib/webPhoto";

export const dynamic = "force-dynamic";

// Individual file downloads. These NO LONGER proxy bytes through Vercel — they
// 302-redirect to a presigned R2 URL (attachment disposition sets the filename),
// so the bytes stream straight from R2 (free egress) and cost zero Fast Origin
// Transfer / Fluid CPU.
//
//   print / raw → the original object, as-is.
//   web/MLS     → the PRE-GENERATED 2048px version (webPhotoKey), also from R2.
//                 Only if that hasn't been generated yet (a brand-new upload the
//                 web-photo cron hasn't processed) do we resize inline this once,
//                 as a self-healing stopgap.

const WEB_MAX_PX  = 2048;
const WEB_QUALITY = 85;

function s3client() {
  // eslint-disable-next-line global-require
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function signedDownload(key, fileName) {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    s3client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    }),
    { expiresIn: 900 }
  );
}

async function r2Exists(key) {
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2Url) return false;
  try {
    const r = await fetch(`${r2Url}/${key}`, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const key    = searchParams.get("key");
  const format = searchParams.get("format") || "web"; // "web" | "print" | "raw"
  const name   = searchParams.get("name") || "image";

  if (!key) return new Response("Missing key", { status: 400 });

  // Per-IP hourly ceiling. Generous so a whole office/household (shared IP) can
  // pull a gallery one-by-one; still blocks automated bulk scraping. Everything
  // now redirects to R2, so these are cheap.
  const dlLimit = format === "print" ? 1000 : 600;
  const rl = await rateLimit(req, "img-dl", dlLimit, 3600);
  if (rl.limited) return new Response("Too many download requests. Please try again later.", { status: 429 });

  if (!process.env.R2_BUCKET_NAME) return new Response("R2 not configured", { status: 500 });

  const baseName = name.replace(/\.[^.]+$/, "");

  // ── print / raw → original object, straight from R2 ──
  if (format === "print" || format === "raw") {
    const ext = (key.match(/\.([^.]+)$/) || [])[1] || (format === "raw" ? "" : "jpg");
    const fileName = ext ? `${baseName}.${ext}` : (name || baseName);
    const url = await signedDownload(key, fileName);
    return Response.redirect(url, 302);
  }

  // ── web/MLS → pre-generated 2048px version, straight from R2 ──
  const wKey = webPhotoKey(key);
  if (await r2Exists(wKey)) {
    const url = await signedDownload(wKey, `${baseName}-MLS.jpg`);
    return Response.redirect(url, 302);
  }

  // Stopgap: the web/MLS version hasn't been generated yet (fresh upload). Resize
  // inline this once; self-heals to the redirect path after the cron runs.
  try {
    const sharp = (await import("sharp")).default;
    const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const r2Res = await fetch(`${r2Url}/${key}`);
    if (!r2Res.ok) return new Response("Source file not found", { status: 404 });

    const webBuffer = await sharp(Buffer.from(await r2Res.arrayBuffer()))
      .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
      .jpeg({ quality: WEB_QUALITY, progressive: true })
      .toBuffer();

    return new Response(webBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "image/jpeg",
        "Content-Disposition": `attachment; filename="${baseName}-MLS.jpg"`,
        "Content-Length":      String(webBuffer.length),
        "Cache-Control":       "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Image download/resize error:", err);
    return new Response("Failed to process image", { status: 500 });
  }
}
