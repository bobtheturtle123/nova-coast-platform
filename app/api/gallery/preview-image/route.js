import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 30;

// Serves a LOW-RES, WATERMARKED derivative of a gallery image for locked
// galleries. Because the actual bytes returned are downscaled + watermarked,
// "Save Image" (incl. iOS long-press) can never grab the clean full-res file —
// even the raw URL is protected. Generated once and cached in R2.
const PREVIEW_MAX = 1280;

function escapeXml(s = "") {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

// Tiled diagonal watermark SVG sized to the image.
function watermarkSvg(w, h, label) {
  const text = escapeXml(label).slice(0, 40);
  const step = 240;
  const rows = Math.ceil(h / step) + 2;
  const cols = Math.ceil(w / step) + 2;
  let marks = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * step - step / 2;
      const y = r * step;
      marks += `<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.30)" letter-spacing="3">${text} · PREVIEW</text>`;
    }
  }
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;
}

function s3client() {
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const key   = searchParams.get("key");
  if (!token || !key) return new Response("Missing params", { status: 400 });

  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2Url) return new Response("Not configured", { status: 500 });

  // Resolve gallery from token.
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return new Response("Not found", { status: 404 });
  const { tenantId, galleryId } = tokenDoc.data();
  const galDoc = await adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get();
  if (!galDoc.exists) return new Response("Not found", { status: 404 });
  const gallery = galDoc.data();
  if (gallery.accessToken !== token) return new Response("Not found", { status: 404 });
  // The requested key must belong to this gallery.
  if (!(gallery.media || []).some((m) => m.key === key)) return new Response("Not found", { status: 404 });

  const previewKey = `previews/${tenantId}/${galleryId}/${crypto.createHash("sha1").update(key).digest("hex")}.jpg`;
  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" };

  // Serve the cached preview if it exists.
  try {
    const cached = await fetch(`${r2Url}/${previewKey}`);
    if (cached.ok) return new Response(Buffer.from(await cached.arrayBuffer()), { status: 200, headers });
  } catch { /* generate below */ }

  // Generate the watermarked preview.
  try {
    const sharp  = (await import("sharp")).default;
    const srcRes = await fetch(`${r2Url}/${key}`);
    if (!srcRes.ok) return new Response("Source not found", { status: 404 });
    const srcBuf = Buffer.from(await srcRes.arrayBuffer());

    const resized = await sharp(srcBuf).resize({ width: PREVIEW_MAX, withoutEnlargement: true }).toBuffer();
    const meta    = await sharp(resized).metadata();
    const w = meta.width || PREVIEW_MAX;
    const h = meta.height || Math.round(PREVIEW_MAX * 0.66);

    const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
    const label     = (tenantDoc.data()?.branding?.businessName || tenantDoc.data()?.businessName || "PREVIEW");

    const out = await sharp(resized)
      .composite([{ input: Buffer.from(watermarkSvg(w, h, label)), top: 0, left: 0 }])
      .jpeg({ quality: 68, progressive: true })
      .toBuffer();

    // Cache to R2 (fire-and-forget).
    (async () => {
      try {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        await s3client().send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME, Key: previewKey, Body: out, ContentType: "image/jpeg",
        }));
      } catch { /* non-fatal */ }
    })();

    return new Response(out, { status: 200, headers });
  } catch (e) {
    console.error("[preview-image]", e?.message);
    return new Response("Preview unavailable", { status: 500 });
  }
}
