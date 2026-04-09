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

const ALL_SKILLS = [
  "classicDaytime", "luxuryDaytime", "drone", "realTwilight",
  "premiumCinematicVideo", "luxuryCinematicVideo", "socialReel",
  "matterport", "zillow3d",
];

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update = {
    name:   (body.name || "").slice(0, 80),
    email:  (body.email || "").toLowerCase(),
    phone:  body.phone || "",
    skills: Array.isArray(body.skills) ? body.skills.filter((s) => ALL_SKILLS.includes(s)) : [],
    color:  body.color || "#0b2a55",
    active: body.active !== false,
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(params.id)
    .update(update);

  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(params.id)
    .delete();

  return Response.json({ ok: true });
}
