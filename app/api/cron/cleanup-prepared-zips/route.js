import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Cleanup cron for the prepared-download buffer.
// Deletes expired prepared ZIPs from R2 and marks their job docs "expired".
// Prepared ZIPs are a transient cache — removing them never affects galleries.

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response("Server misconfiguration", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  const now = Date.now();
  let expired = 0, deleted = 0, errors = 0;

  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const snap = await adminDb.collection("preparedZips")
    .where("status", "in", ["ready", "preparing", "pending", "failed"]).get();

  for (const doc of snap.docs) {
    const d = doc.data();
    const isExpired = d.expiresAt && new Date(d.expiresAt).getTime() < now;
    if (!isExpired) continue;
    expired++;
    if (d.key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: d.key }));
        deleted++;
      } catch (e) {
        errors++;
        console.error("[cleanup-prepared-zips] R2 delete failed:", d.key, e?.message);
      }
    }
    await doc.ref.update({ status: "expired", expiredAt: new Date().toISOString() });
  }

  return Response.json({ expired, deleted, errors });
}
