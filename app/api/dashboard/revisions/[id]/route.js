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

// PATCH /api/dashboard/revisions/[id]
// Body: { status: "acknowledged" | "resolved", adminNotes?: string }
export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { status, adminNotes } = await req.json();
  const allowed = ["acknowledged", "resolved"];
  if (!allowed.includes(status)) {
    return Response.json({ error: "Invalid status." }, { status: 400 });
  }

  const ref = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("revisionRequests").doc(params.id);

  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Not found." }, { status: 404 });

  const update = {
    status,
    updatedAt: new Date(),
  };
  if (adminNotes !== undefined) update.adminNotes = String(adminNotes).slice(0, 2000);
  if (status === "resolved") update.resolvedAt = new Date();

  await ref.update(update);
  return Response.json({ ok: true });
}
