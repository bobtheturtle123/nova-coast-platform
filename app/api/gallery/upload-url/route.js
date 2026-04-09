import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminAuth } from "@/lib/firebase-admin";

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
    // Verify authenticated tenant member
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authHeader);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { fileName, fileType, galleryId } = await req.json();
    if (!fileName || !galleryId) {
      return Response.json({ error: "fileName and galleryId required" }, { status: 400 });
    }

    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key  = `galleries/${decoded.tenantId}/${galleryId}/${Date.now()}_${safe}`;

    const command = new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET,
      Key:         key,
      ContentType: fileType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return Response.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Upload URL error:", err);
    return Response.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
