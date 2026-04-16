import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { publicUrl, fileName, fileType, key } = await req.json();

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id)
    .update({
      media: FieldValue.arrayUnion({ url: publicUrl, key: key || "", fileName, fileType, uploadedAt: new Date().toISOString() }),
    });

  return Response.json({ ok: true });
}

// DELETE: remove one or more media items by key
export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { keys } = await req.json(); // keys: string[]
  if (!Array.isArray(keys) || keys.length === 0) {
    return Response.json({ error: "keys array required" }, { status: 400 });
  }

  const galleryRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);

  const snap = await galleryRef.get();
  if (!snap.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const gallery = snap.data();
  const keySet  = new Set(keys);
  const updated = (gallery.media || []).filter((m) => !keySet.has(m.key));

  await galleryRef.update({ media: updated });

  // Best-effort R2 deletion (no auth needed for admin delete, uses service account)
  try {
    const { S3Client, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region:   "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY,
      },
    });
    const objects = keys.map((k) => ({ Key: k }));
    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET,
      Delete: { Objects: objects },
    }));
  } catch {
    // Non-fatal — media removed from gallery even if R2 cleanup fails
  }

  return Response.json({ ok: true, remaining: updated.length });
}
