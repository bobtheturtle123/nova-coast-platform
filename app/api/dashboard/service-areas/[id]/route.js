import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { tenantId: decoded.tenantId };
}

export async function PATCH(req, { params }) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const allowed = ["name", "type", "color", "assignedTo", "notes", "paths"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("serviceAreas").doc(params.id)
      .update(update);

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const ctx = await getCtx(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("serviceAreas").doc(params.id)
      .delete();

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to delete" }, { status: 500 });
  }
}
