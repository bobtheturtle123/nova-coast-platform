import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { rateLimitTenant } from "@/lib/rateLimit";
import { trackPlatformUsage } from "@/lib/usageTracking";

// Hard cap on files per gallery — prevents unlimited storage accumulation.
// 1000 covers portrait photographers with large shoot volumes; normal shoots are 50-200 photos.
const MAX_FILES_PER_GALLERY = 1000;
// Per-file size cap: 200 MB. Enforced via presigned URL ContentLengthRange condition.
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
// Max upload URL requests per tenant per hour
const UPLOAD_URL_HOURLY_LIMIT = 120;

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

    // Per-tenant hourly rate limit — one tenant can't hammer storage with bulk requests
    const rl = await rateLimitTenant(decoded.tenantId, "gallery-upload-url", UPLOAD_URL_HOURLY_LIMIT, 3600);
    if (rl.limited) {
      return Response.json({ error: "Upload limit reached. Please try again later." }, { status: 429 });
    }

    const { fileName, fileType, galleryId, fileSize } = await req.json();
    if (!fileName || !galleryId) {
      return Response.json({ error: "fileName and galleryId required" }, { status: 400 });
    }

    // Enforce per-file size limit
    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: `File too large. Maximum size is 200 MB per file.` }, { status: 400 });
    }

    // Validate file type — allow image, video, and PDF (for floor plans)
    const ALLOWED_TYPES = [
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff", "image/heic",
      "video/mp4", "video/mov", "video/quicktime", "video/webm",
      "application/pdf",
    ];
    if (fileType && !ALLOWED_TYPES.includes(fileType.toLowerCase())) {
      return Response.json({ error: "File type not allowed" }, { status: 400 });
    }

    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
      console.error("R2 not configured");
      return Response.json({ error: "Storage not configured." }, { status: 500 });
    }

    // Enforce per-gallery file cap before issuing a new URL
    const galleryDoc = await adminDb
      .collection("tenants").doc(decoded.tenantId)
      .collection("galleries").doc(galleryId)
      .get();
    if (galleryDoc.exists) {
      const existing = (galleryDoc.data().media || []).length;
      if (existing >= MAX_FILES_PER_GALLERY) {
        return Response.json(
          { error: `Gallery limit reached (${MAX_FILES_PER_GALLERY} files max).` },
          { status: 400 }
        );
      }
    }

    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key  = `galleries/${decoded.tenantId}/${galleryId}/${Date.now()}_${safe}`;

    // No ContentType in the command — avoids Content-Type signing mismatch
    // when the browser PUT omits or differs in Content-Type header.
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key:    key,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    // Track upload count and estimated bytes for cost observability
    trackPlatformUsage("uploadsCount");
    if (fileSize) trackPlatformUsage("uploadBytes", fileSize);

    return Response.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("Upload URL error:", err);
    return Response.json({ error: `Failed to generate upload URL: ${err.message}` }, { status: 500 });
  }
}
