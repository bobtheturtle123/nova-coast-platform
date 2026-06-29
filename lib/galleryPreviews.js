// Helpers for the watermarked locked-gallery previews stored under
// previews/{galleryId}/ in R2. Once a gallery is paid/unlocked the previews are
// dead weight, so we delete them; a cron also sweeps old ones as a backstop.

function s3client() {
  // eslint-disable-next-line global-require
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
}

// Delete every preview object for one gallery. Safe to call repeatedly
// (idempotent). Path: previews/{tenantId}/{galleryId}/.
export async function deleteGalleryPreviews(tenantId, galleryId) {
  if (!tenantId || !galleryId || !process.env.R2_BUCKET_NAME) return 0;
  try {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const s3 = s3client();
    const Bucket = process.env.R2_BUCKET_NAME;
    let deleted = 0, ContinuationToken;
    do {
      const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `previews/${tenantId}/${galleryId}/`, ContinuationToken }));
      const objs = (list.Contents || []).map((o) => ({ Key: o.Key }));
      if (objs.length) {
        await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objs } }));
        deleted += objs.length;
      }
      ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return deleted;
  } catch (e) {
    console.warn("[deleteGalleryPreviews]", e?.message);
    return 0;
  }
}
