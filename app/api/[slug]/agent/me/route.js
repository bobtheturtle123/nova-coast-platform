import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

// GET /api/[slug]/agent/me?token=xxx — fetch agent profile
export async function GET(req, { params }) {
  const token  = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "token required." }, { status: 400 });

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found." }, { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const d = snap.docs[0].data();
  return Response.json({
    agent: {
      id:          snap.docs[0].id,
      name:        d.name        || "",
      email:       d.email       || "",
      phone:       d.phone       || "",
      isAgentPro:  d.isAgentPro  || false,
    },
  });
}

// PATCH /api/[slug]/agent/me — update editable profile fields
export async function PATCH(req, { params }) {
  const { token, phone } = await req.json();
  if (!token) return Response.json({ error: "token required." }, { status: 400 });

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found." }, { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const update = {};
  if (phone !== undefined) update.phone = String(phone).slice(0, 30);

  await snap.docs[0].ref.update({ ...update, updatedAt: new Date() });
  return Response.json({ ok: true });
}
