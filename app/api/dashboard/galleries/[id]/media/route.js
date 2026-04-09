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
