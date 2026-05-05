import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// GET /api/dashboard/galleries/[id]/activity
// Returns the activityLog subcollection for admin display.
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id)
    .collection("activityLog")
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  const events = snap.docs.map((d) => {
    const data = d.data();
    const ts   = data.timestamp?.toDate?.() || null;
    return {
      id:          d.id,
      event:       data.event,
      viewerName:  data.viewerName  || data.email || null,
      viewerEmail: data.viewerEmail || null,
      note:        data.note        || null,
      fileName:    data.fileName    || null,
      format:      data.format      || null,
      fileCount:   data.fileCount   || null,
      ip:          data.ip          || null,
      userAgent:   data.userAgent   || null,
      timestamp:   ts ? ts.toISOString() : null,
    };
  });

  return Response.json({ events });
}

// POST /api/dashboard/galleries/[id]/activity
// Admin-written event (manual note, etc.)
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body  = await req.json().catch(() => ({}));
  const event = (body.event || "note").slice(0, 64);
  const note  = (body.note  || "").slice(0, 256);

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries").doc(params.id)
    .collection("activityLog")
    .add({ event, note, timestamp: new Date(), adminWritten: true });

  return Response.json({ ok: true });
}
