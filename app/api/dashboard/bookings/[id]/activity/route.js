import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

// GET — returns statusHistory + bookingNotes merged, newest first
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const data = doc.data();

  const statusEntries = (data.statusHistory || []).map((h) => ({
    type: "status",
    status: h.status,
    changedAt: h.changedAt,
    changedBy: h.changedBy,
    note: h.note || null,
  }));

  const noteEntries = (data.bookingNotes || []).map((n) => ({
    type: "note",
    note: n.text,
    changedAt: n.createdAt,
    changedBy: n.createdBy,
    authorName: n.authorName || null,
  }));

  const all = [...statusEntries, ...noteEntries].sort((a, b) => {
    const aTime = a.changedAt ? new Date(a.changedAt).getTime() : 0;
    const bTime = b.changedAt ? new Date(b.changedAt).getTime() : 0;
    return bTime - aTime;
  });

  return Response.json({ activity: all });
}

// POST — append a manual note to bookingNotes
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { text, authorName } = await req.json();
  if (!text?.trim()) return Response.json({ error: "Note text required" }, { status: 400 });

  const note = {
    text: text.trim(),
    createdAt: new Date().toISOString(),
    createdBy: ctx.uid,
    authorName: authorName || null,
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ bookingNotes: FieldValue.arrayUnion(note) });

  return Response.json({ ok: true, note });
}
