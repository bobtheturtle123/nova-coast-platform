import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

// PATCH /api/photographer/bookings/[id]/status
// Body: { workflowStatus: string }
// Photographers can advance to: shot_completed, postponed, cancelled
const PHOTOGRAPHER_ALLOWED = ["shot_completed", "postponed", "cancelled"];

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { workflowStatus } = await req.json();
  if (!workflowStatus || !PHOTOGRAPHER_ALLOWED.includes(workflowStatus)) {
    return Response.json({ error: "Invalid or disallowed status for photographer." }, { status: 400 });
  }

  const ref = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);

  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Not found." }, { status: 404 });

  const data = snap.data();
  // Verify this booking is assigned to this photographer
  const memberDoc = await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get();
  if (!memberDoc.exists) return Response.json({ error: "Unauthorized." }, { status: 403 });
  const memberEmail = memberDoc.data().email || "";

  const isAssigned = data.photographerId === ctx.memberId || data.photographerEmail === memberEmail;
  if (!isAssigned) return Response.json({ error: "Not assigned to this booking." }, { status: 403 });

  await ref.update({
    workflowStatus,
    statusHistory: FieldValue.arrayUnion({
      status:    workflowStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: `photographer:${ctx.memberId}`,
    }),
    updatedAt: new Date(),
  });

  return Response.json({ ok: true, workflowStatus });
}
