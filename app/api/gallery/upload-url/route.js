import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

export async function POST(req) {
  try {
    const { filename, contentType, galleryId } = await req.json();

    if (!filename || !galleryId) {
      return Response.json({ error: "filename and galleryId required" }, { status: 400 });
    }

    // Sanitize filename
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key  = `galleries/${galleryId}/${Date.now()}_${safe}`;

    const command = new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET,
      Key:         key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl  = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl  = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return Response.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Upload URL error:", err);
    return Response.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
