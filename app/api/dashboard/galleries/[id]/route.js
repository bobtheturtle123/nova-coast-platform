import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { galleryDeliveryStatus } from "@/lib/zipJobs";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [doc, tenantDoc] = await Promise.all([
    adminDb.collection("tenants").doc(ctx.tenantId).collection("galleries").doc(params.id).get(),
    adminDb.collection("tenants").doc(ctx.tenantId).get(),
  ]);

  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const gallery = doc.data();
  const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;

  // Single "ready to deliver?" answer (Web Ready photos done + package ZIP built).
  return Response.json({
    gallery: { id: doc.id, ...gallery },
    deliveryStatus: galleryDeliveryStatus(gallery, autoRename),
  });
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["unlocked", "media", "categories", "matterportUrl", "matterportHidden", "videoUrl", "videoUrlHidden", "virtualLinks", "mlsUrl", "floorPlans", "attachedFiles", "authorizedEmails", "agentCanShare"];
  const update = {};
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id)
    .update(update);

  return Response.json({ ok: true });
}
