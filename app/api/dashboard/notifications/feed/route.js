import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

const col = (tenantId) =>
  adminDb.collection("tenants").doc(tenantId).collection("notifications");

// GET — latest notifications + unread count.
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await col(ctx.tenantId).orderBy("createdAt", "desc").limit(30).get();
  const items = snap.docs.map((d) => {
    const x = d.data();
    const created = x.createdAt?.toMillis ? x.createdAt.toMillis() : (x.createdAt ? new Date(x.createdAt).getTime() : Date.now());
    return { id: d.id, type: x.type || "info", title: x.title, body: x.body || "", link: x.link || null, read: !!x.read, createdAt: created };
  });
  const unread = items.filter((i) => !i.read).length;
  return Response.json({ items, unread });
}

// POST — mark read. { all: true } or { ids: [...] }.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { all, ids } = await req.json().catch(() => ({}));
  const batch = adminDb.batch();

  if (all) {
    const snap = await col(ctx.tenantId).where("read", "==", false).limit(200).get();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  } else if (Array.isArray(ids) && ids.length) {
    ids.slice(0, 50).forEach((id) => batch.update(col(ctx.tenantId).doc(id), { read: true }));
  } else {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await batch.commit();
  return Response.json({ ok: true });
}
