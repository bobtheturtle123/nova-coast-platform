import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

// GET — photographer's own time blocks
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .where("memberId", "==", ctx.memberId)
    .get();

  const blocks = snap.docs.map((d) => {
    const data = d.data();
    return {
      id:        d.id,
      memberId:  data.memberId,
      startDate: data.startDate,
      endDate:   data.endDate,
      allDay:    data.allDay !== false,
      startTime: data.startTime || null,
      endTime:   data.endTime   || null,
      reason:    data.reason,
      note:      data.note,
      source:    data.source || "manual",
    };
  });

  return Response.json({ blocks });
}

// POST — add a time block
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.startDate || !body.endDate) {
    return Response.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const allDay = body.allDay !== false; // default all day
  const id = uuidv4();
  const block = {
    id,
    memberId:   ctx.memberId,
    tenantId:   ctx.tenantId,
    startDate:  body.startDate,
    endDate:    body.endDate,
    allDay,
    startTime:  allDay ? null : (body.startTime || "09:00"),
    endTime:    allDay ? null : (body.endTime   || "17:00"),
    reason:     body.reason || "Blocked",
    note:       body.note   || "",
    createdAt:  new Date(),
    createdBy:  "photographer",
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks").doc(id)
    .set(block);

  return Response.json({ ok: true, block: { id, memberId: block.memberId, startDate: block.startDate, endDate: block.endDate, allDay: block.allDay, startTime: block.startTime, endTime: block.endTime, reason: block.reason, note: block.note } });
}

// DELETE — remove a block (only own blocks)
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks").doc(id)
    .get();

  if (!doc.exists || doc.data().memberId !== ctx.memberId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await doc.ref.delete();
  return Response.json({ ok: true });
}
