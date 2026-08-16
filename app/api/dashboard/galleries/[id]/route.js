import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { galleryDeliveryStatus, prepareGalleryPackage } from "@/lib/zipJobs";
import { maybeKickWebPhotoGeneration } from "@/lib/webPhotoKick";

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

  const ref = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id);
  await ref.update(update);

  if (update.unlocked === true) {
    // Unlocking a gallery for download is a deliberate "make this deliverable"
    // action — do the full prep (Web Ready generation + queued ZIP build) so the
    // package is waiting by the time the agent opens it.
    await prepareGalleryPackage(ctx.tenantId, params.id);
  } else if (update.media !== undefined) {
    // A media edit (new uploads, reorder, hide) changed the set — start any
    // missing Web Ready/MLS generation right away. The ZIP build is deliberately
    // NOT enqueued here: it's kicked automatically the instant the last Web Ready
    // version lands (so a big upload builds ONE package at the end), or on the
    // next deliberate deliver/unlock — never once per edit. Read fresh since the
    // set just changed.
    await maybeKickWebPhotoGeneration(ctx.tenantId, params.id, null);
  }

  // Return the fresh delivery status so the dashboard can reconcile its "Ready to
  // deliver" badge immediately after an edit instead of waiting for the next poll.
  const snap = await ref.get();
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;
  return Response.json({
    ok: true,
    deliveryStatus: galleryDeliveryStatus(snap.data() || {}, autoRename),
  });
}
