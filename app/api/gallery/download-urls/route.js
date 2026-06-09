import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";
import { partitionVideos } from "@/lib/galleryZip";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// GET /api/gallery/download-urls?token=...&type=videos
// Returns pre-signed R2 download URLs so the browser downloads large files
// (videos especially) DIRECTLY from R2 — bypassing the Vercel function and its
// egress cost entirely. R2 egress is free, so this is the cheap path for the
// heavy bytes. The Vercel ZIP route handles only the small, value-added photo
// bundle (resized/organized) + floor plans + documents.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const type  = searchParams.get("type") || "videos"; // "videos" | "all"

  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });

  const rl = await rateLimit(req, `dl-urls:${token}`, 20, 3600);
  if (rl.limited) return Response.json({ error: "Too many requests" }, { status: 429 });

  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return Response.json({ error: "Gallery not found" }, { status: 404 });

  const { tenantId, galleryId } = tokenDoc.data();
  const galleryDoc = await adminDb
    .collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get();
  if (!galleryDoc.exists) return Response.json({ error: "Gallery not found" }, { status: 404 });

  const gallery = galleryDoc.data();
  if (gallery.accessToken !== token) return Response.json({ error: "Gallery not found" }, { status: 404 });
  if (!gallery.unlocked) return Response.json({ error: "Gallery is locked" }, { status: 403 });

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) return Response.json({ error: "Storage not configured" }, { status: 500 });

  const media  = (gallery.media || []).filter((m) => m.key && !m.hidden);
  const videos = media.filter((m) => m.fileType?.startsWith("video/"));

  // For "videos": return only the videos delivered SEPARATELY (the large ones).
  // Small videos are bundled inside the ZIP, so the client must not also fetch
  // them directly — that would download them twice. "all" still returns
  // everything (used by other callers).
  const pick = type === "all" ? media : partitionVideos(videos).separate;

  const files = await Promise.all(
    pick.map(async (m, i) => {
      const fileName = m.fileName || m.key.split("/").pop() || `file-${i + 1}`;
      // After 1-year retention, the full-res original is gone — serve the 1080p
      // web version so the download still works.
      const dlKey = m.originalRemoved && m.webVideoKey ? m.webVideoKey : m.key;
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key:    dlKey,
        // Force a download (not inline playback) with a clean filename.
        ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      return { name: fileName, url, fileType: m.fileType || "" };
    })
  );

  return Response.json({ files });
}
