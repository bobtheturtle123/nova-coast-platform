import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminAuth } from "@/lib/firebase-admin";

const s3 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(req) {
  try {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authHeader);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { fileName, fileType } = await req.json();
    if (!fileName) return Response.json({ error: "fileName required" }, { status: 400 });

    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
      return Response.json({ error: "Storage not configured" }, { status: 500 });
    }

    // Only allow images and videos
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/quicktime","video/webm"];
    if (fileType && !allowed.includes(fileType)) {
      return Response.json({ error: "Only image and video files are allowed" }, { status: 400 });
    }

    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key  = `products/${decoded.tenantId}/${Date.now()}_${safe}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    key,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return Response.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Product upload URL error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
