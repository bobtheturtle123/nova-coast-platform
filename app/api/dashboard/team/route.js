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
  const calendarToken = uuidv4().replace(/-/g, "");
  const member = {
    id,
    name:          (body.name || "").slice(0, 80),
    email:         (body.email || "").toLowerCase(),
    phone:         body.phone || "",
    skills:        Array.isArray(body.skills) ? body.skills.map(String).slice(0, 50) : [],
    color:         body.color || "#0b2a55",
    active:        body.active !== false,
    payRate:       body.payRate != null ? Number(body.payRate) || 0 : 0,
    serviceRates:  body.serviceRates && typeof body.serviceRates === "object" ? body.serviceRates : {},
    calendarToken,
    tenantId:      ctx.tenantId,
  };

  const batch = adminDb.batch();
  batch.set(
    adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(id),
    member
  );
  // Top-level lookup so the iCal endpoint can find tenantId without collectionGroup query
  batch.set(
    adminDb.collection("calendarTokens").doc(calendarToken),
    { tenantId: ctx.tenantId, memberId: id }
  );
  await batch.commit();

  return Response.json({ member });
}
