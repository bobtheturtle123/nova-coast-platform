// Daily backstop sweep for locked-gallery watermarked previews.
// Deletes preview objects older than 30 days (most are already removed the
// moment a gallery is paid/unlocked; this catches long-unpaid stragglers).

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const MAX_AGE_DAYS = 30;

function s3client() {
  // eslint-disable-next-line global-require
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.R2_BUCKET_NAME) return Response.json({ ok: false, error: "Storage not configured" });

  const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const s3 = s3client();
  const Bucket = process.env.R2_BUCKET_NAME;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  let scanned = 0, deleted = 0, ContinuationToken;
  try {
    do {
      const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: "previews/", ContinuationToken }));
      const old = (list.Contents || []).filter((o) => {
        scanned++;
        const ms = o.LastModified ? new Date(o.LastModified).getTime() : 0;
        return ms && ms < cutoff;
      }).map((o) => ({ Key: o.Key }));
      // DeleteObjects allows up to 1000 keys per call.
      for (let i = 0; i < old.length; i += 1000) {
        const batch = old.slice(i, i + 1000);
        await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: batch } }));
        deleted += batch.length;
      }
      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (e) {
    return Response.json({ ok: false, scanned, deleted, error: e?.message }, { status: 500 });
  }

  return Response.json({ ok: true, scanned, deleted });
}
