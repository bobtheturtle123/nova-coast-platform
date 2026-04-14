import { adminAuth, adminDb } from "@/lib/firebase-admin";

async function getTenantId(req) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.tenantId || null;
}

// PATCH /api/dashboard/customer-teams/[id] — update team
export async function PATCH(req, { params }) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const allowed = ["name", "members", "notes"];
    const update = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("customerTeams").doc(params.id)
      .update(update);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PATCH customer-teams:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/dashboard/customer-teams/[id] — delete team
export async function DELETE(req, { params }) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    await adminDb
      .collection("tenants").doc(tenantId)
      .collection("customerTeams").doc(params.id)
      .delete();

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE customer-teams:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
