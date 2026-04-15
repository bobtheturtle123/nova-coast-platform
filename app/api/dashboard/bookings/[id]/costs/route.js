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

export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = ctx;
  const { id } = params;

  const bookingRef = adminDb.doc(`tenants/${tenantId}/bookings/${id}`);
  const snap = await bookingRef.get();

  if (!snap.exists) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = snap.data();
  const costs = booking.costs || [];

  return Response.json({ costs });
}

export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = ctx;
  const { id } = params;

  const body = await req.json();
  const {
    shooterFee = 0,
    editorFee = 0,
    travelCost = 0,
    otherCosts = 0,
    shootHours,
    editHoursPerPhoto,
    notes,
  } = body;

  const totalCost = shooterFee + editorFee + travelCost + otherCosts;

  const costs = {
    shooterFee,
    editorFee,
    travelCost,
    otherCosts,
    shootHours,
    editHoursPerPhoto,
    notes,
    totalCost,
    savedAt: new Date(),
  };

  const bookingRef = adminDb.doc(`tenants/${tenantId}/bookings/${id}`);
  await bookingRef.update({ costs });

  return Response.json({ ok: true, costs });
}
