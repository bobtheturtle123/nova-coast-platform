import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminAuth } from "@/lib/firebase-admin";
import { rateLimitTenant } from "@/lib/rateLimit";

const s3 = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

// POST /api/dashboard/upload-image
// Returns a presigned upload URL + public URL for a single image.
// ?folder=agent-logos|branding|misc   (default: misc)
export async function POST(req) {
  try {
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authHeader);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // 20 image uploads per tenant per hour (logos, branding assets, etc.)
    const rl = await rateLimitTenant(decoded.tenantId, "upload-image", 20, 3600);
    if (rl.limited) {
      return Response.json({ error: "Upload limit reached. Please try again later." }, { status: 429 });
    }

    const { fileName, fileType, folder = "misc" } = await req.json();
    if (!fileName) return Response.json({ error: "fileName required" }, { status: 400 });

    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY || !process.env.R2_BUCKET) {
      return Response.json({ error: "Storage not configured" }, { status: 500 });
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (fileType && !allowed.includes(fileType)) {
      return Response.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key  = `${safeFolder}/${decoded.tenantId}/${Date.now()}_${safe}`;

    const command = new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET,
      Key:         key,
      ContentType: fileType || "image/jpeg",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return Response.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Upload image error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
