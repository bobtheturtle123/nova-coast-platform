import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

function sanitize(val) {
  if (val === null || val === undefined) return val;
  if (val?.toDate) return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(sanitize);
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = sanitize(v);
    return out;
  }
  return val;
}

export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const memberDoc = await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get();
  if (!memberDoc.exists) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const memberEmail = memberDoc.data().email || "";

  const bookingDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const raw = sanitize(bookingDoc.data());

  // Verify this photographer is assigned to this booking
  const isAssigned =
    raw.photographerId === ctx.memberId ||
    (memberEmail && raw.photographerEmail?.toLowerCase() === memberEmail.toLowerCase());

  if (!isAssigned) return Response.json({ error: "Forbidden" }, { status: 403 });

  return Response.json({
    booking: {
      id:             bookingDoc.id,
      status:         raw.status,
      workflowStatus: raw.workflowStatus || null,
      shootDate:      raw.shootDate,
      preferredDate:  raw.preferredDate,
      preferredTime:  raw.preferredTime,
      address:        raw.address,
      fullAddress:    raw.fullAddress,
      city:           raw.city,
      state:          raw.state,
      clientName:     raw.clientName,
      clientPhone:    raw.clientPhone,
      serviceIds:     raw.serviceIds,
      packageId:      raw.packageId,
      addonIds:       raw.addonIds,
      notes:          raw.notes,
      payRate:        raw.photographerPayRate ?? null,
    },
  });
}
