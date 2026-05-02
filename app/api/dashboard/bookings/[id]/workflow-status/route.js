import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { WORKFLOW_STATUSES } from "@/lib/workflowStatus";

const VALID_IDS = new Set(WORKFLOW_STATUSES.map((s) => s.id));

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { workflowStatus, note } = await req.json();
  if (!VALID_IDS.has(workflowStatus)) {
    return Response.json({ error: "Invalid workflow status." }, { status: 400 });
  }

  const historyEntry = {
    status:    workflowStatus,
    changedAt: new Date().toISOString(),
    changedBy: ctx.uid,
    ...(note ? { note } : {}),
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({
      workflowStatus,
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt:     new Date(),
    });

  return Response.json({ ok: true, workflowStatus });
}
