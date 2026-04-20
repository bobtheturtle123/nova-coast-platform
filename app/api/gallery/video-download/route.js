import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

// GET /api/gallery/video-download?token=...&key=...&name=...
// Returns a presigned R2 URL with Content-Disposition: attachment so the browser
// triggers a file save rather than opening the video in a new tab.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const key   = searchParams.get("key");
  const name  = searchParams.get("name") || "video";

  if (!token || !key) return new Response("Missing params", { status: 400 });

  const rl = await rateLimit(req, `video-dl:${token}`, 20, 3600);
  if (rl.limited) return new Response("Too many download requests. Please try again later.", { status: 429 });

  // Resolve gallery via token index
  const tokenDoc = await adminDb.collection("galleryTokens").doc(token).get();
  if (!tokenDoc.exists) return new Response("Gallery not found", { status: 404 });

  const { tenantId, galleryId } = tokenDoc.data();
  const galleryDoc = await adminDb
    .collection("tenants").doc(tenantId)
    .collection("galleries").doc(galleryId)
    .get();

  if (!galleryDoc.exists) return new Response("Gallery not found", { status: 404 });

  const gallery = galleryDoc.data();
  if (gallery.accessToken !== token) return new Response("Gallery not found", { status: 404 });
  if (!gallery.unlocked) return new Response("Gallery is locked. Please pay the balance first.", { status: 403 });

  // Verify the requested key belongs to this gallery's media
  const allKeys = (gallery.media || []).map((m) => m.key).filter(Boolean);
  if (!allKeys.includes(key)) {
    return new Response("File not found in this gallery", { status: 404 });
  }

  if (!process.env.R2_BUCKET) {
    return new Response("Storage not configured", { status: 500 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket:                     process.env.R2_BUCKET,
      Key:                        key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(name)}"`,
    });

    // 15-minute window — enough for slow connections
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    return Response.redirect(presignedUrl, 302);
  } catch (err) {
    console.error("[video-download]", err);
    return new Response("Failed to generate download link", { status: 500 });
  }
}
