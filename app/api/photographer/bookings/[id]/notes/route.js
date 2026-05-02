import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

// GET  /api/photographer/bookings/[id]/notes — fetch photographer notes
// PATCH /api/photographer/bookings/[id]/notes — save photographer notes
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ref = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json({ photographerNotes: snap.data().photographerNotes || "" });
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { notes } = await req.json();

  const ref = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Not found." }, { status: 404 });

  // Verify assignment
  const memberDoc = await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get();
  if (!memberDoc.exists) return Response.json({ error: "Unauthorized." }, { status: 403 });
  const memberEmail = memberDoc.data().email || "";
  const data = snap.data();
  const isAssigned = data.photographerId === ctx.memberId || data.photographerEmail === memberEmail;
  if (!isAssigned) return Response.json({ error: "Not assigned to this booking." }, { status: 403 });

  await ref.update({
    photographerNotes: String(notes || "").slice(0, 3000),
    updatedAt: new Date(),
  });

  return Response.json({ ok: true });
}
