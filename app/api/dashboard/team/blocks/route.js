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

// GET — list all time blocks
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks")
    .orderBy("startDate", "asc")
    .get();

  const blocks = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      startDate: data.startDate?.toDate?.()?.toISOString?.() ?? data.startDate,
      endDate:   data.endDate?.toDate?.()?.toISOString?.()   ?? data.endDate,
    };
  });

  return Response.json({ blocks });
}

// POST — create a time block
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { memberId, memberName, startDate, endDate, reason, note } = body;

  if (!startDate || !endDate) {
    return Response.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const ref = adminDb.collection("tenants").doc(ctx.tenantId).collection("timeBlocks").doc();
  const block = {
    id:          ref.id,
    memberId:    memberId    || null,  // null = entire team blocked
    memberName:  memberName  || "All Team",
    startDate:   new Date(startDate),
    endDate:     new Date(endDate),
    reason:      reason || "Time Off",
    note:        note   || "",
    createdAt:   new Date(),
  };

  await ref.set(block);
  return Response.json({ block: { ...block, startDate, endDate, createdAt: block.createdAt.toISOString() } });
}

// DELETE — remove a time block by id (passed as query param)
export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("timeBlocks").doc(id)
    .delete();

  return Response.json({ ok: true });
}
