import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

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

// GET — list team members
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").get();

  const members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Response.json({ members });
}

// POST — create team member
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body  = await req.json();
  const id    = uuidv4().replace(/-/g, "").slice(0, 16);
  const member = {
    id,
    name:   (body.name || "").slice(0, 80),
    email:  (body.email || "").toLowerCase(),
    phone:  body.phone || "",
    skills: Array.isArray(body.skills) ? body.skills.filter((s) => ALL_SKILLS.includes(s)) : [],
    color:  body.color || "#0b2a55",
    active: body.active !== false,
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(id)
    .set(member);

  return Response.json({ member });
}
